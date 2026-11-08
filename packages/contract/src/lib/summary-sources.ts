import type { SummaryBullet } from '@/schemas/summaries';

/** The message ids the bullets cite, each once, in order of first citation. */
export function citedSourceIds(bullets: readonly SummaryBullet[]): string[] {
  return [...new Set(bullets.flatMap((bullet) => bullet.sourceIds))];
}
