import { fileErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function fileError(code: keyof typeof fileErrors, message?: string) {
  return new DomainError(code, message ?? fileErrors[code].message);
}
