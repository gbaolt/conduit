import { organizationErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function organizationError(code: keyof typeof organizationErrors) {
  return new DomainError(code, organizationErrors[code].message);
}
