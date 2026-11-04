/** A rule violation named by a contract error code. `infrastructure/orpc/errors.ts` turns it into the API error. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
