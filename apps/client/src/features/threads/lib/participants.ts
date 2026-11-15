const list = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** Who is in a thread, from the viewer's side: "Just you", "Linh Pham and you", "Linh Pham, Arjun Rao, and you". */
export function participantsLabel(
  participantIds: readonly string[],
  viewerId: string,
  nameOf: (userId: string) => string
) {
  const others = participantIds.filter((id) => id !== viewerId).map(nameOf);
  if (others.length === 0) return 'Just you';
  return list.format(
    participantIds.includes(viewerId) ? [...others, 'you'] : others
  );
}
