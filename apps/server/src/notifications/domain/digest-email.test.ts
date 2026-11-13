import { describe, expect, it } from 'vitest';

import type { DigestMention } from './digest';
import { buildDigestEmail, DIGEST_MENTIONS_MAX } from './digest-email';

const recipient = { userId: 'bao-id', name: 'Bao' };
const appUrl = 'https://app.test';

const mention = (
  index: number,
  overrides: Partial<DigestMention> = {}
): DigestMention => ({
  roomId: 'room',
  roomName: 'design',
  roomKind: 'channel',
  notify: null,
  muted: false,
  messageId: `message-${index}`,
  parentId: null,
  authorName: 'Linh',
  body: 'Can you review this?',
  createdAt: new Date(Date.UTC(2026, 10, 13, 9, index)),
  ...overrides,
});

describe('buildDigestEmail', () => {
  it('names the author and room for one mention, and links to the message', () => {
    const email = buildDigestEmail({
      mentions: [mention(1)],
      recipient,
      appUrl,
    });

    expect(email.subject).toBe('Linh mentioned you in #design');
    expect(email.text).toContain(
      'https://app.test/channels/room?message=message-1'
    );
    expect(email.html).toContain(
      'href="https://app.test/channels/room?message=message-1"'
    );
  });

  it('opens a reply in its thread and a DM in the DMs route', () => {
    const email = buildDigestEmail({
      mentions: [
        mention(1, { parentId: 'root', roomKind: 'dm', roomName: 'x' }),
      ],
      recipient,
      appUrl,
    });

    expect(email.subject).toBe('Linh mentioned you in a direct message');
    expect(email.text).toContain(
      'https://app.test/dms/room?thread=root&message=message-1'
    );
  });

  it('lists up to 20 mentions, newest first, then "and N more" linking to Activity', () => {
    const mentions = Array.from({ length: 24 }, (_, index) => mention(index));
    const email = buildDigestEmail({ mentions, recipient, appUrl });

    expect(email.subject).toBe('You have 24 unread mentions on Conduit');
    expect(email.text.match(/message=message-/g)).toHaveLength(
      DIGEST_MENTIONS_MAX
    );
    expect(email.text.indexOf('message-23')).toBeLessThan(
      email.text.indexOf('message-22')
    );
    expect(email.text).not.toContain('message=message-3\n');
    expect(email.text).toContain('and 4 more: https://app.test/activity');
    expect(email.html).toContain('and 4 more');
  });

  it('adds no "more" line for 20 or fewer', () => {
    const mentions = Array.from({ length: 20 }, (_, index) => mention(index));

    expect(
      buildDigestEmail({ mentions, recipient, appUrl }).text
    ).not.toContain('more');
  });

  it('shows the excerpt as plain text, with mentions named', () => {
    const email = buildDigestEmail({
      mentions: [
        mention(1, {
          body: '**Hey** <@bao-id>, see [the doc](https://x.test) and `code` <@other> <@here>',
        }),
      ],
      recipient,
      appUrl,
    });

    expect(email.text).toContain(
      'Hey @Bao, see the doc and code @someone @here'
    );
  });

  it('cuts a long excerpt', () => {
    const email = buildDigestEmail({
      mentions: [mention(1, { body: 'word '.repeat(100) })],
      recipient,
      appUrl,
    });

    expect(email.text).toContain('word...');
    expect(email.text).not.toContain('word '.repeat(40));
  });

  it('escapes HTML in names and message text', () => {
    const email = buildDigestEmail({
      mentions: [
        mention(1, { authorName: '<b>Linh</b>', body: '<script>x</script>' }),
      ],
      recipient,
      appUrl,
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<b>Linh</b>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('links the footer to the notification settings', () => {
    const email = buildDigestEmail({
      mentions: [mention(1)],
      recipient,
      appUrl,
    });

    expect(email.html).toContain(
      'href="https://app.test/settings/notifications"'
    );
    expect(email.text).toContain('https://app.test/settings/notifications');
  });
});
