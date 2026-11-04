import { channelErrors, channelSectionErrors } from '@conduit/contract';

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
