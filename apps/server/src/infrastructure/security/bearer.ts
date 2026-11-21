import { timingSafeEqual } from 'node:crypto';

/** Whether `header` is `Bearer <secret>`. The compare takes the same time wherever the two differ. */
export function bearerMatches(
  header: string | undefined,
  secret: string | undefined
) {
  if (!secret || !header?.startsWith('Bearer ')) return false;

  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
