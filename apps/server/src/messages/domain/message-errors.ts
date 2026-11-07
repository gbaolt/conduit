import { messageErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function messageError(
  code: keyof typeof messageErrors,
  message?: string
) {
  return new DomainError(code, message ?? messageErrors[code].message);
}
