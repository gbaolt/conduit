import { askErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function askError(code: keyof typeof askErrors) {
  return new DomainError(code, askErrors[code].message);
}
