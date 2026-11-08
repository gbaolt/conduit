import {
  channelErrors,
  channelSectionErrors,
  dmErrors,
} from '@conduit/contract';

import { DomainError } from '@/shared/domain/domain-error';

export function channelError(
  code: keyof typeof channelErrors,
  message?: string
) {
  return new DomainError(code, message ?? channelErrors[code].message);
}

export function sectionError(code: keyof typeof channelSectionErrors) {
  return new DomainError(code, channelSectionErrors[code].message);
}

export function dmError(code: keyof typeof dmErrors, message?: string) {
  return new DomainError(code, message ?? dmErrors[code].message);
}
