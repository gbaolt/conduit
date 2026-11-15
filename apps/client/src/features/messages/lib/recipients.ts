import {
  type Dm,
  DM_MEMBERS_MAX,
  type DmMember,
  type Room,
  type SidebarEntry,
} from '@conduit/contract';

/** A DM member, with their email when the workspace member list has them. */
type Person = DmMember & { email?: string };

type ChannelRow = { kind: 'channel'; key: string; room: Room };
type PersonRow = {
  kind: 'person';
  key: string;
  person: Person;
  isViewer: boolean;
};
type GroupRow = { kind: 'group'; key: string; people: PersonRow[] };

/** A row the To field offers. Picking a group DM picks its people. */
export type Recipient = ChannelRow | PersonRow | GroupRow;

/** Who a new message goes to: one channel, or people who share a DM. Never both. */
export type To = ChannelRow | { kind: 'people'; people: PersonRow[] };

export const NOBODY: To = { kind: 'people', people: [] };

export const chipsOf = (to: To): Recipient[] =>
  to.kind === 'channel' ? [to] : to.people;

export const labelOf = (row: Recipient) => {
  switch (row.kind) {
    case 'channel':
      return row.room.name;
    case 'person':
      return row.person.name;
    case 'group':
      return row.people.map((member) => member.person.name).join(', ');
  }
};

/** The highlighted row's detail: a person's email, a channel's topic, or a group DM's size. */
export function detailOf(row: Recipient) {
  switch (row.kind) {
    case 'channel': {
      const { topic, description, memberCount } = row.room;
      return (
        topic ||
        description ||
        `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
      );
    }
    case 'person':
      return row.person.email ?? '';
    case 'group':
      return `Group DM, ${row.people.length + 1} people with you`;
  }
}

/** Applies the To field's new chips. A channel replaces everything, and a person replaces a channel. */
export function choose(to: To, next: readonly Recipient[]): To {
  const current = chipsOf(to);
  const added = next.find(
    (row) => !current.some((chip) => chip.key === row.key)
  );

  if (!added) {
    const kept = (row: Recipient) => next.some((chip) => chip.key === row.key);
    if (to.kind === 'channel') return kept(to) ? to : NOBODY;
    return { kind: 'people', people: to.people.filter(kept) };
  }
  if (added.kind === 'channel') return added;

  const incoming = added.kind === 'group' ? added.people : [added];
  const people = [...(to.kind === 'people' ? to.people : []), ...incoming];
  const unique = people.filter(
    (row, index) => people.findIndex((other) => other.key === row.key) === index
  );
  // The viewer always joins the DM, so they only count toward the limit when they are not a chip.
  const limit = unique.some((row) => row.isViewer)
    ? DM_MEMBERS_MAX
    : DM_MEMBERS_MAX - 1;
  return { kind: 'people', people: unique.slice(0, limit) };
}

/** `#` searches channels only, `@` people and group DMs only. Otherwise names of either. */
export function matchesQuery(row: Recipient, query: string) {
  const text = query.trim().toLowerCase();
  const sigil = text[0];
  if (sigil === '#' && row.kind !== 'channel') return false;
  if (sigil === '@' && row.kind === 'channel') return false;
  const needle = sigil === '#' || sigil === '@' ? text.slice(1) : text;
  return labelOf(row).toLowerCase().includes(needle);
}

/**
 * Everything a new message can go to, the most recent conversation first: the channels the viewer can post
 * in, every person, and each group DM. A person ranks by their DM with the viewer.
 */
export function recipientsOf({
  channels,
  dms,
  people,
  entries,
  viewerId,
}: {
  channels: readonly Room[];
  dms: readonly Dm[];
  people: readonly Person[];
  entries: readonly SidebarEntry[];
  viewerId: string;
}): Recipient[] {
  const lastAt = new Map(
    entries.map((entry) => [entry.roomId, entry.lastMessageAt?.getTime() ?? 0])
  );
  const activity = (roomId: string, fallback: Date | null) =>
    lastAt.get(roomId) || fallback?.getTime() || 0;

  const byId = new Map(people.map((person) => [person.userId, person]));
  const personRow = (person: Person): PersonRow => ({
    kind: 'person',
    key: `person:${person.userId}`,
    person: byId.get(person.userId) ?? person,
    isViewer: person.userId === viewerId,
  });

  const ranked: { row: Recipient; at: number }[] = channels.map((room) => ({
    row: { kind: 'channel', key: `channel:${room.id}`, room },
    at: activity(room.id, null),
  }));

  const personAt = new Map<string, number>();
  for (const dm of dms) {
    const others = dm.members.filter((member) => member.userId !== viewerId);
    const at = activity(dm.id, dm.lastMessageAt);
    if (others.length > 1) {
      ranked.push({
        row: {
          kind: 'group',
          key: `group:${dm.id}`,
          people: others.map(personRow),
        },
        at,
      });
    } else {
      personAt.set(others[0]?.userId ?? viewerId, at);
    }
  }
  for (const person of people) {
    ranked.push({
      row: personRow(person),
      at: personAt.get(person.userId) ?? 0,
    });
  }

  return ranked
    .sort((a, b) => b.at - a.at || labelOf(a.row).localeCompare(labelOf(b.row)))
    .map(({ row }) => row);
}
