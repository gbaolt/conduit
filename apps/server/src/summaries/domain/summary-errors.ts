import { summaryErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function summaryError(code: keyof typeof summaryErrors) {
  return new DomainError(code, summaryErrors[code].message);
}
