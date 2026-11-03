import { channelErrors, channelSectionErrors } from '@conduit/contract';
import { ORPCError } from '@orpc/server';

export function channelError(
  code: keyof typeof channelErrors,
  message?: string
) {
  return new ORPCError(code, {
    ...channelErrors[code],
    message: message ?? channelErrors[code].message,
  });
}

export function sectionError(code: keyof typeof channelSectionErrors) {
  return new ORPCError(code, channelSectionErrors[code]);
}
