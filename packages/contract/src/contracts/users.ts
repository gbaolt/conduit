import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';

import { SessionOutputSchema } from '@/schemas/users';

export const getSessionContract = oc
  .meta(openapi({ method: 'GET', path: '/users/session' }))
  .output(SessionOutputSchema);
