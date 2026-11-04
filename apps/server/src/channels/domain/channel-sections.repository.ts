import type { ChannelSection } from '@conduit/contract';

/** One user's sections in one workspace. Sections are private to their owner. */
export type SectionScope = { userId: string; organizationId: string };

export abstract class ChannelSectionsRepository {
  abstract list(scope: SectionScope): Promise<ChannelSection[]>;

  /** Appends the section after the scope's last one. Throws `NAME_TAKEN`. */
  abstract create(scope: SectionScope, name: string): Promise<ChannelSection>;

  /** Throws `NAME_TAKEN`. */
  abstract rename(sectionId: string, name: string): Promise<ChannelSection>;

  /** The section's channels fall back to Channels. */
  abstract delete(sectionId: string): Promise<void>;

  abstract exists(scope: SectionScope, sectionId: string): Promise<boolean>;

  /** How many of `sectionIds` the scope owns. */
  abstract count(scope: SectionScope, sectionIds: string[]): Promise<number>;

  /** Sets each section's position to its index in `sectionIds`. */
  abstract reorder(sectionIds: string[]): Promise<void>;
}
