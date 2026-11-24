import { canvasErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function canvasError(code: keyof typeof canvasErrors) {
  return new DomainError(code, canvasErrors[code].message);
}
