import type { ModelSummary, SummaryBullet } from '@conduit/contract';

import type { PartialObject } from '@/ai/domain/model.port';

const BULLETS_MAX = 12;

/**
 * The bullets whose citations hold up. A label the model never saw is dropped, and so is a bullet left with
 * no source or no text. What remains cites message ids. With `writing`, the object is half finished, so its
 * last bullet shows as its text streams in, before any source it cites has arrived.
 */
export function citedBullets(
  summary: PartialObject<ModelSummary> | undefined,
  labels: ReadonlyMap<string, string>,
  { writing = false } = {}
): SummaryBullet[] {
  const drafts = summary?.bullets ?? [];
  const bullets: SummaryBullet[] = [];

  drafts.forEach((bullet, index) => {
    const text = bullet?.text?.trim();
    const sourceIds = new Set<string>();
    for (const label of bullet?.sourceIds ?? []) {
      const messageId = label === undefined ? undefined : labels.get(label);
      if (messageId) sourceIds.add(messageId);
    }

    const open = writing && index === drafts.length - 1;
    if (text && (sourceIds.size > 0 || open)) {
      bullets.push({ text, sourceIds: [...sourceIds] });
    }
  });

  return bullets.slice(0, BULLETS_MAX);
}
