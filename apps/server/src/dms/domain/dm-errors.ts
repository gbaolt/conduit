import { dmErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function dmError(code: keyof typeof dmErrors, message?: string) {
  return new DomainError(code, message ?? dmErrors[code].message);
}
