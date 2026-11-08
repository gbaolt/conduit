import { roomErrors } from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function roomError(code: keyof typeof roomErrors) {
  return new DomainError(code, roomErrors[code].message);
}
