/** A closed DM is open again once a message arrives after the member closed it. */
export function isDmOpen(
  closedAt: Date | null,
  lastMessageAt: Date | null
): boolean {
  return (
    closedAt === null || (lastMessageAt?.getTime() ?? 0) > closedAt.getTime()
  );
}
