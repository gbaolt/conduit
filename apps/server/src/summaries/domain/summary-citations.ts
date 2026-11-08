import type { ModelSummary, SummaryBullet } from '@conduit/contract';

import type { PartialObject } from '@/ai/domain/model.port';

const BULLETS_MAX = 12;

/**
 * The bullets whose citations hold up. A label the model never saw is dropped, and so is a bullet left with
 * no source or no text. What remains cites message ids. Works on a half-finished object too, so a bullet
 * shows only once a source it cites has arrived.
 */
export function citedBullets(
  summary: PartialObject<ModelSummary> | undefined,
  labels: ReadonlyMap<string, string>
): SummaryBullet[] {
  const bullets: SummaryBullet[] = [];

  for (const bullet of summary?.bullets ?? []) {
    const text = bullet?.text?.trim();
    const sourceIds = new Set<string>();
    for (const label of bullet?.sourceIds ?? []) {
      const messageId = label === undefined ? undefined : labels.get(label);
      if (messageId) sourceIds.add(messageId);
    }

    if (text && sourceIds.size > 0) {
      bullets.push({ text, sourceIds: [...sourceIds] });
    }
  }

  return bullets.slice(0, BULLETS_MAX);
}
