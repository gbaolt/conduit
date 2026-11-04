import type { SessionOutput } from '@conduit/contract';

/** Sessions, which Better Auth owns. */
export abstract class SessionsGateway {
  /** The session the headers carry, or null when there is none. */
  abstract get(headers: Headers): Promise<SessionOutput>;
}
