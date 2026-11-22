import { Injectable } from '@nestjs/common';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  gateway,
  hasToolCall,
  isStepCount,
  type LanguageModel,
  Output,
  parsePartialJson,
  streamText,
  type TextStreamPart,
  tool,
  type ToolSet,
} from 'ai';

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

/** The tool a request with tools answers through. No tool of the caller's may take its name. */
const ANSWER_TOOL = 'answer';

/**
 * Structured output from the AI SDK. Reads the environment on each call, so a server with no provider still boots.
 *
 * With tools, the answer is one more tool the model must call last. The JSON response format that `Output.object`
 * sends on every step kept the model from calling a tool at all: it answered at once from the prompt, and made up
 * what it could not see. Measured in November 2026 with DeepSeek V4.1 Flash, which then called `channel` when asked.
 */
@Injectable()
export class AiSdkModel implements ModelPort {
  async *streamObject<T>(
    request: ModelRequest<T>
  ): AsyncGenerator<PartialObject<T>> {
    const model = selectModel(process.env);

    let failure: unknown;
    const common = {
      model,
      ...(request.images?.length
        ? {
            messages: [
              {
                role: 'user' as const,
                content: [
                  { type: 'text' as const, text: request.prompt },
                  ...request.images.map((image) => ({
                    type: 'file' as const,
                    data: image.data,
                    mediaType: image.mediaType,
                  })),
                ],
              },
            ],
          }
        : { prompt: request.prompt }),
      maxOutputTokens: request.maxOutputTokens,
      // A reasoning model otherwise spends the whole output cap thinking and never writes the object.
      reasoning: 'none' as const,
      // OpenRouter takes its order from the model above; only the gateway reads this.
      providerOptions: { gateway: { order: GATEWAY_ORDER } },
      abortSignal: request.signal,
      temperature: 0.2,
      maxRetries: 1,
      onError: ({ error }: { error: unknown }) => {
        failure = error;
      },
    };

    try {
      if (request.tools) {
        const result = streamText({
          ...common,
          system: `${request.system}\nWhen you are ready to answer, call ${ANSWER_TOOL} once, with the answer.`,
          tools: {
            ...Object.fromEntries(
              Object.entries(request.tools).map(
                ([name, { description, input, execute }]) => [
                  name,
                  tool({ description, inputSchema: input, execute }),
                ]
              )
            ),
            [ANSWER_TOOL]: tool({
              description: 'Give the final answer. Call it last, once.',
              inputSchema: request.schema,
            }),
          },
          toolChoice: 'required',
          // Answering is one more step after the tool rounds.
          stopWhen: [
            hasToolCall(ANSWER_TOOL),
            isStepCount((request.maxToolSteps ?? 0) + 1),
          ],
        });
        const answer = yield* answerInputs<T>(result.fullStream);
        if (failure) throw failure;
        // The tool rounds ran out before the model answered.
        if (answer === undefined) throw new Error('The model gave no answer.');
        yield request.schema.parse(answer) as PartialObject<T>;
        return;
      }
      const result = streamText({
        ...common,
        system: request.system,
        output: Output.object({ schema: request.schema }),
      });
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

/** Yields the `answer` tool's input as it streams, and returns it as the model finished it. */
async function* answerInputs<T>(
  stream: AsyncIterable<TextStreamPart<ToolSet>>
): AsyncGenerator<PartialObject<T>, unknown> {
  let answerId: string | undefined;
  let text = '';
  let answer: unknown;
  for await (const part of stream) {
    if (part.type === 'tool-input-start' && part.toolName === ANSWER_TOOL) {
      answerId = part.id;
      text = '';
    } else if (part.type === 'tool-input-delta' && part.id === answerId) {
      text += part.delta;
      const { value } = await parsePartialJson(text);
      if (value && typeof value === 'object') yield value as PartialObject<T>;
    } else if (part.type === 'tool-call' && part.toolName === ANSWER_TOOL) {
      answer = part.input;
    }
  }
  return answer;
}
