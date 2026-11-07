import type { JoinableWorkspace } from '@conduit/contract';

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

  abstract listDomains(organizationId: string): Promise<string[]>;

  /** Makes `domains` the workspace's whole list. */
  abstract setDomains(organizationId: string, domains: string[]): Promise<void>;

  abstract allowsDomain(
    organizationId: string,
    domain: string
  ): Promise<boolean>;

  /** Workspaces that allow `domain` and have no member row for the user, deactivated or not. */
  abstract listJoinable(
    userId: string,
    domain: string
  ): Promise<JoinableWorkspace[]>;
}
