import { realtimeErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function realtimeError(
  code: keyof typeof realtimeErrors,
  message?: string
) {
  return new DomainError(code, message ?? realtimeErrors[code].message);
}
