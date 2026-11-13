import { feedErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function feedError(code: keyof typeof feedErrors, message?: string) {
  return new DomainError(code, message ?? feedErrors[code].message);
}
