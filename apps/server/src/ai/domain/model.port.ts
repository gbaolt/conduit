import type { z } from 'zod';

/** What a streamed object looks like before the model finishes it. */
export type PartialObject<T> = T extends readonly (infer Item)[]
  ? (PartialObject<Item> | undefined)[]
  : T extends object
    ? { [Key in keyof T]?: PartialObject<T[Key]> }
    : T;

export type ModelRequest<T> = {
  system: string;
  prompt: string;
  /** The shape the model must return. */
  schema: z.ZodType<T>;
  /** Required, so no call can run without a ceiling on what it spends. */
  maxOutputTokens: number;
  signal?: AbortSignal;
};

/** The language model behind every AI feature. Which provider answers is a configuration choice. */
export abstract class ModelPort {
  /**
   * Yields the object as it grows, and last the object the model finished, validated against `schema`.
   * Throws `AI_UNAVAILABLE` when no provider is configured, the provider refuses, or the output does not fit `schema`.
   */
  abstract streamObject<T>(
    request: ModelRequest<T>
  ): AsyncIterable<PartialObject<T>>;
}
