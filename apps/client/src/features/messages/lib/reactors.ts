const LISTED = 2;

/** Who reacted, as a tooltip reads it: "You, Linh, and 3 others". The viewer comes first. */
export function reactorLabel(
  userIds: readonly string[],
  names: ReadonlyMap<string, string>,
  viewerId: string | null
) {
  const ordered = [...userIds].sort(
    (a, b) => Number(b === viewerId) - Number(a === viewerId)
  );
  const label = (id: string) =>
    id === viewerId ? 'You' : (names.get(id) ?? 'Former member');

  if (ordered.length <= LISTED + 1) return join(ordered.map(label));

  const rest = ordered.length - LISTED;
  return `${ordered.slice(0, LISTED).map(label).join(', ')}, and ${rest} others`;
}

function join(items: string[]) {
  if (items.length <= 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}
