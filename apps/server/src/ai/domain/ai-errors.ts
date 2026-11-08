import { aiErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function aiError(code: keyof typeof aiErrors) {
  return new DomainError(code, aiErrors[code].message);
}
