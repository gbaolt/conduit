/** The join link and allowed domains, which this app owns. */
export abstract class JoinAccessRepository {
  /** The workspace's token, stored as `token` first if it has none. Safe under a race. */
  abstract getOrCreateToken(
    organizationId: string,
    createdById: string,
    token: string
  ): Promise<string>;

  /** Replaces the token, so every old URL stops resolving. */
  abstract replaceToken(
    organizationId: string,
    createdById: string,
    token: string
  ): Promise<void>;

  abstract findByToken(token: string): Promise<{
    organizationId: string;
    organizationName: string;
    logo: string | null;
  } | null>;
}
