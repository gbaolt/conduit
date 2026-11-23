import type { z } from 'zod';

/** What a streamed object looks like before the model finishes it. */
export type PartialObject<T> = T extends readonly (infer Item)[]
  ? (PartialObject<Item> | undefined)[]
  : T extends object
    ? { [Key in keyof T]?: PartialObject<T[Key]> }
    : T;

/** A read-only function the model may call before it answers. Its result goes back to the model as text. */
export type ModelTool<Input = never> = {
  description: string;
  input: z.ZodType<Input>;
  execute: (input: Input) => Promise<string>;
};

/** Tools by the name the model calls them. */
// `any` lets one record hold tools whose inputs differ.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModelTools = Record<string, ModelTool<any>>;

/** A picture the model looks at alongside the prompt. */
export type ModelImage = { mediaType: string; data: Uint8Array };

export type ModelRequest<T> = {
  system: string;
  prompt: string;
  /** Sent after the prompt, in this order. The model must read images. */
  images?: ModelImage[];
  /** The shape the model must return. */
  schema: z.ZodType<T>;
  /** Required, so no call can run without a ceiling on what it spends. */
  maxOutputTokens: number;
  signal?: AbortSignal;
  tools?: ModelTools;
  /** How many rounds of tool calls may run before the answer. Required with `tools`. */
  maxToolSteps?: number;
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
