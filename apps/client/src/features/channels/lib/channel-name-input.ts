import {
  ChannelNameSchema,
  hasNonLatinLetters,
  toChannelName,
} from '@conduit/contract';
import { z } from 'zod';

/** What people type: any Latin text. It parses to the normalized name the API takes. */
export const ChannelNameInputSchema = z
  .string()
  .refine(
    (input) => !hasNonLatinLetters(input),
    'Use Latin letters. Accents are fine.'
  )
  .transform(toChannelName)
  .pipe(ChannelNameSchema);
