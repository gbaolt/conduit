import type {
  Room,
  WorkspaceInvitation,
  WorkspaceMember,
} from '@conduit/contract';
import { parseAsString, parseAsStringLiteral } from 'nuqs/server';

type Named = { name: string };
type Choices<Extra> = Record<string, { label: string } & Extra>;
type Test<Item> = { test: (item: Item) => boolean };
type Compare<Item> = { compare: (a: Item, b: Item) => number };

const choices = <T extends object>(table: T) =>
  Object.keys(table) as (keyof T & string)[];

const aToZ = (a: Named, b: Named) => a.name.localeCompare(b.name);
const zToA = (a: Named, b: Named) => b.name.localeCompare(a.name);

export const PEOPLE_ROLES = {
  any: { label: 'Any role', test: () => true },
  owner: { label: 'Owners', test: (m) => m.role === 'owner' },
  admin: { label: 'Admins', test: (m) => m.role === 'admin' },
  member: { label: 'Members', test: (m) => m.role === 'member' },
} satisfies Choices<Test<WorkspaceMember>>;

export const PEOPLE_ACCOUNTS = {
  active: { label: 'Active', test: (m) => m.status === 'active' },
  deactivated: { label: 'Deactivated', test: (m) => m.status !== 'active' },
} satisfies Choices<Test<WorkspaceMember>>;

export const PEOPLE_SORTS = {
  'a-z': { label: 'A to Z', compare: aToZ },
  'z-a': { label: 'Z to A', compare: zToA },
  newest: {
    label: 'Recently joined',
    compare: (a, b) => b.joinedAt.getTime() - a.joinedAt.getTime(),
  },
} satisfies Choices<Compare<WorkspaceMember>>;

/** `archived` reads a different list, so it has no test of its own. */
export const CHANNEL_MEMBERSHIPS = {
  all: { label: 'All channels', test: () => true },
  joined: { label: 'My channels', test: (c) => c.membership !== null },
  other: { label: 'Other channels', test: (c) => c.membership === null },
  archived: { label: 'Archived', test: () => true },
} satisfies Choices<Test<Room>>;

export const CHANNEL_TYPES = {
  any: { label: 'Any channel type', test: () => true },
  public: { label: 'Public', test: (c) => c.visibility === 'public' },
  private: { label: 'Private', test: (c) => c.visibility === 'private' },
} satisfies Choices<Test<Room>>;

export const CHANNEL_SORTS = {
  'a-z': { label: 'A to Z', compare: aToZ },
  'z-a': { label: 'Z to A', compare: zToA },
  newest: {
    label: 'Newest channel',
    compare: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  },
  oldest: {
    label: 'Oldest channel',
    compare: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  },
  'most-members': {
    label: 'Most members',
    compare: (a, b) => b.memberCount - a.memberCount || aToZ(a, b),
  },
  'fewest-members': {
    label: 'Fewest members',
    compare: (a, b) => a.memberCount - b.memberCount || aToZ(a, b),
  },
} satisfies Choices<Compare<Room>>;

export const INVITATION_ROLES = {
  any: { label: 'Any role', test: () => true },
  admin: { label: 'Admins', test: (i) => i.role === 'admin' },
  member: { label: 'Members', test: (i) => i.role === 'member' },
} satisfies Choices<Test<WorkspaceInvitation>>;

const byEmail = (a: WorkspaceInvitation, b: WorkspaceInvitation) =>
  a.email.localeCompare(b.email);

export const INVITATION_SORTS = {
  'expires-soon': {
    label: 'Expires soonest',
    compare: (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime(),
  },
  'expires-late': {
    label: 'Expires latest',
    compare: (a, b) => b.expiresAt.getTime() - a.expiresAt.getTime(),
  },
  'a-z': { label: 'A to Z', compare: byEmail },
  'z-a': { label: 'Z to A', compare: (a, b) => byEmail(b, a) },
} satisfies Choices<Compare<WorkspaceInvitation>>;

/** The People tab's state in the URL, as in `?q=ana&role=admin&sort=newest`. */
export const peopleParams = {
  q: parseAsString.withDefault(''),
  role: parseAsStringLiteral(choices(PEOPLE_ROLES)).withDefault('any'),
  account: parseAsStringLiteral(choices(PEOPLE_ACCOUNTS)).withDefault('active'),
  sort: parseAsStringLiteral(choices(PEOPLE_SORTS)).withDefault('a-z'),
};

/** The Channels tab's state in the URL, as in `?show=other&type=public&sort=most-members`. */
export const channelParams = {
  q: parseAsString.withDefault(''),
  show: parseAsStringLiteral(choices(CHANNEL_MEMBERSHIPS)).withDefault('all'),
  type: parseAsStringLiteral(choices(CHANNEL_TYPES)).withDefault('any'),
  sort: parseAsStringLiteral(choices(CHANNEL_SORTS)).withDefault('a-z'),
};

/** The Invitations tab's state in the URL, as in `?q=ana&role=admin&sort=a-z`. */
export const invitationParams = {
  q: parseAsString.withDefault(''),
  role: parseAsStringLiteral(choices(INVITATION_ROLES)).withDefault('any'),
  sort: parseAsStringLiteral(choices(INVITATION_SORTS)).withDefault(
    'expires-soon'
  ),
};

type PeopleQuery = {
  q: string;
  role: keyof typeof PEOPLE_ROLES;
  account: keyof typeof PEOPLE_ACCOUNTS;
  sort: keyof typeof PEOPLE_SORTS;
};

type ChannelQuery = {
  q: string;
  show: keyof typeof CHANNEL_MEMBERSHIPS;
  type: keyof typeof CHANNEL_TYPES;
  sort: keyof typeof CHANNEL_SORTS;
};

const needleOf = (q: string) => q.trim().replace(/^[#@]/, '').toLowerCase();

/** Members who pass every filter, in the chosen order. The search matches a name or an email. */
export function findPeople(
  members: readonly WorkspaceMember[],
  query: PeopleQuery
) {
  const needle = needleOf(query.q);
  return members
    .filter(
      (m) =>
        PEOPLE_ROLES[query.role].test(m) &&
        PEOPLE_ACCOUNTS[query.account].test(m) &&
        (m.name.toLowerCase().includes(needle) ||
          m.email.toLowerCase().includes(needle))
    )
    .sort(PEOPLE_SORTS[query.sort].compare);
}

/** Channels that pass every filter, in the chosen order. The search matches a name or a description. */
export function findChannels(channels: readonly Room[], query: ChannelQuery) {
  const needle = needleOf(query.q);
  return channels
    .filter(
      (c) =>
        CHANNEL_MEMBERSHIPS[query.show].test(c) &&
        CHANNEL_TYPES[query.type].test(c) &&
        (c.name.toLowerCase().includes(needle) ||
          (c.description ?? '').toLowerCase().includes(needle))
    )
    .sort(CHANNEL_SORTS[query.sort].compare);
}

type InvitationQuery = {
  q: string;
  role: keyof typeof INVITATION_ROLES;
  sort: keyof typeof INVITATION_SORTS;
};

/** Pending invitations that pass every filter, in the chosen order. The search matches the email or the inviter. */
export function findInvitations(
  invitations: readonly WorkspaceInvitation[],
  query: InvitationQuery
) {
  const needle = needleOf(query.q);
  return invitations
    .filter(
      (i) =>
        INVITATION_ROLES[query.role].test(i) &&
        (i.email.toLowerCase().includes(needle) ||
          i.inviterName.toLowerCase().includes(needle))
    )
    .sort(INVITATION_SORTS[query.sort].compare);
}
