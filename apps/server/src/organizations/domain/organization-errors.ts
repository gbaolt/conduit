import { contract } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

const organizationErrors = contract.organizations.create['~orpc'].errorMap;

export function organizationError(code: keyof typeof organizationErrors) {
  return new DomainError(code, organizationErrors[code].message);
}
