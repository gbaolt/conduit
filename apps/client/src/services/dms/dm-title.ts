import type { Dm } from '@conduit/contract';

/** The people a DM is with, not counting the viewer. The self DM is named "<you> (you)". */
export function dmTitle(dm: Pick<Dm, 'members'>, viewerId: string) {
  const others = dm.members.filter((member) => member.userId !== viewerId);
  if (others.length === 0) {
    return `${dm.members[0]?.name ?? 'You'} (you)`;
  }
  return others.map((member) => member.name).join(', ');
}

/** The self DM first, then the rest in the order given. */
export function selfFirst<T extends Pick<Dm, 'members'>>(
  dms: readonly T[],
  viewerId: string
) {
  const isSelf = (dm: T) =>
    dm.members.length === 1 && dm.members[0]?.userId === viewerId;
  return [...dms.filter(isSelf), ...dms.filter((dm) => !isSelf(dm))];
}
