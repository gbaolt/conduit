/** `<organizationId>:<sorted user ids joined by ,>`. The same people in any order, with repeats, give the same key. */
export function dmKey(organizationId: string, userIds: readonly string[]) {
  return `${organizationId}:${[...new Set(userIds)].sort().join(',')}`;
}
