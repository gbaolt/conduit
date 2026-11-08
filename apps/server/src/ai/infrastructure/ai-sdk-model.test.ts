import { generateText } from 'ai';
import { describe, expect, it } from 'vitest';

import { selectModel } from './ai-sdk-model';

const completion = {
  id: 'gen-1',
  model: 'test/model:free',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'ok' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

describe('selectModel', () => {
  it('refuses to start without a model id', () => {
    expect(() => selectModel({ OPENROUTER_API_KEY: 'key' })).toThrow(
      expect.objectContaining({ code: 'AI_UNAVAILABLE' })
    );
  });

  it('refuses to start without a provider', () => {
    expect(() => selectModel({ AI_SUMMARY_MODEL: 'test/model:free' })).toThrow(
      expect.objectContaining({ code: 'AI_UNAVAILABLE' })
    );
  });

  it.each([
    { AI_GATEWAY_API_KEY: 'key' },
    { VERCEL_OIDC_TOKEN: 'token' },
    { VERCEL: '1' },
  ])('uses the gateway in production, as with %o', (env) => {
    const model = selectModel({
      AI_SUMMARY_MODEL: 'openai/gpt-5-mini',
      OPENROUTER_API_KEY: 'key',
      ...env,
    });

    expect(model).toMatchObject({ modelId: 'openai/gpt-5-mini' });
    expect(model).not.toMatchObject({ provider: 'openrouter.chat' });
  });

  it('denies data collection on every OpenRouter request', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImplementation = (async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json(completion);
    }) as typeof fetch;

    const model = selectModel(
      { AI_SUMMARY_MODEL: 'test/model:free', OPENROUTER_API_KEY: 'key' },
      fetchImplementation
    );
    await generateText({ model, prompt: 'hi', maxOutputTokens: 8 });
    await generateText({ model, prompt: 'again', maxOutputTokens: 8 });

    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body.provider).toMatchObject({ data_collection: 'deny' });
      expect(body.max_tokens).toBe(8);
    }
  });
});
