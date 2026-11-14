import { Injectable } from '@nestjs/common';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { gateway, type LanguageModel, Output, streamText } from 'ai';

import { aiError } from '@/ai/domain/ai-errors';
import type {
  ModelPort,
  ModelRequest,
  PartialObject,
} from '@/ai/domain/model.port';

type Env = Record<string, string | undefined>;

/**
 * DeepInfra's standard tier is tried first: the cheapest host of the default model that is not a low-priority
 * `flex` queue. Others take over when it fails. OpenRouter names the tier, and the gateway has only the one.
 */
const GATEWAY_ORDER = ['deepinfra'];
const OPENROUTER_ORDER = ['deepinfra/fp8'];

/**
 * Production reaches models through the Vercel AI Gateway, which signs in with `AI_GATEWAY_API_KEY` or, on Vercel,
 * the deployment's OIDC token. Without those, development reaches OpenRouter with `OPENROUTER_API_KEY`.
 * `AI_SUMMARY_MODEL` names the model in whichever provider answers.
 */
export function selectModel(
  env: Env,
  fetchImplementation?: typeof fetch
): LanguageModel {
  const modelId = env.AI_SUMMARY_MODEL;
  if (!modelId) {
    throw aiError('AI_UNAVAILABLE');
  }

  if (env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || env.VERCEL) {
    return gateway(modelId);
  }

  if (env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
      fetch: fetchImplementation,
    });
    // `allow` lets `:free` providers, which keep and train on prompts, serve the request, so workspace messages
    // reach them. `require_parameters` keeps out providers that would ignore the JSON schema.
    // OpenRouter ignores the call's `reasoning: 'none'` and needs its own.
    return openrouter(modelId, {
      reasoning: { effort: 'none' },
      provider: {
        order: OPENROUTER_ORDER,
        data_collection: 'allow',
        require_parameters: true,
      },
    });
  }

  throw aiError('AI_UNAVAILABLE');
}

/** Structured output from the AI SDK. Reads the environment on each call, so a server with no provider still boots. */
@Injectable()
export class AiSdkModel implements ModelPort {
  async *streamObject<T>(
    request: ModelRequest<T>
  ): AsyncGenerator<PartialObject<T>> {
    const model = selectModel(process.env);

    let failure: unknown;
    const result = streamText({
      model,
      system: request.system,
      prompt: request.prompt,
      output: Output.object({ schema: request.schema }),
      maxOutputTokens: request.maxOutputTokens,
      // A reasoning model otherwise spends the whole output cap thinking and never writes the object.
      reasoning: 'none',
      // OpenRouter takes its order from the model above; only the gateway reads this.
      providerOptions: { gateway: { order: GATEWAY_ORDER } },
      abortSignal: request.signal,
      temperature: 0.2,
      maxRetries: 1,
      onError: ({ error }) => {
        failure = error;
      },
    });

    try {
      for await (const partial of result.partialOutputStream) {
        yield partial as PartialObject<T>;
      }
      if (failure) throw failure;
      yield (await result.output) as PartialObject<T>;
    } catch (error) {
      if (request.signal?.aborted) throw error;
      // The prompt holds workspace messages, so log the failure and never the request.
      console.error(
        '[ai] model call failed:',
        error instanceof Error ? error.message : error
      );
      throw aiError('AI_UNAVAILABLE');
    }
  }
}
