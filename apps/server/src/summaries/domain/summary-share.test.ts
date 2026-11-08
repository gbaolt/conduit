import { MESSAGE_BODY_MAX, type Summary } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { summaryMessageBody } from './summary-share';

const summary = (overrides: Partial<Summary> = {}): Summary => ({
  id: 's1',
  roomId: 'c1',
  parentId: null,
  from: null,
  to: null,
  messageCount: 12,
  bullets: [
    { text: 'Launch moved.', sourceIds: ['a', 'b'] },
    { text: 'Docs are late.', sourceIds: ['b'] },
  ],
  sourceMessageIds: ['a', 'b'],
  sharedMessageId: null,
  createdAt: new Date(0),
  ...overrides,
});

describe('summaryMessageBody', () => {
  it('numbers each source by its place in the summary and links it to the message', () => {
    expect(summaryMessageBody(summary(), '/channels/c1')).toBe(
      [
        '**Summary of 12 messages** (written by AI)',
        '',
        '- Launch moved. [1](/channels/c1?message=a) [2](/channels/c1?message=b)',
        '- Docs are late. [2](/channels/c1?message=b)',
      ].join('\n')
    );
  });

  it('links a thread summary through the thread', () => {
    const body = summaryMessageBody(summary({ parentId: 'root' }), '/dms/c1');

    expect(body).toContain('[1](/dms/c1?thread=root&message=a)');
  });

  it('leaves out the bullets that would pass the message limit', () => {
    const body = summaryMessageBody(
      summary({
        bullets: Array.from({ length: 12 }, () => ({
          text: 'x'.repeat(1000),
          sourceIds: ['a'],
        })),
      }),
      '/channels/c1'
    );

    expect(body.length).toBeLessThanOrEqual(MESSAGE_BODY_MAX);
    expect(body.match(/^- /gm)?.length).toBeLessThan(12);
  });
});
