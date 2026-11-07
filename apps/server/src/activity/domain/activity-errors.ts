import { activityErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function activityError(
  code: keyof typeof activityErrors,
  message?: string
) {
  return new DomainError(code, message ?? activityErrors[code].message);
}
