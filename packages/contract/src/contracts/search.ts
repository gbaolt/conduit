import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';

import { SearchInputSchema, SearchOutputSchema } from '@/schemas/search';

/** Messages, files, channels, and people the caller can read that match the text. */
export const searchContract = oc
  .meta(openapi({ method: 'POST', path: '/search' }))
  .input(SearchInputSchema)
  .output(SearchOutputSchema);
