import type { DigestMention } from './digest';

export const DIGEST_MENTIONS_MAX = 20;
const EXCERPT_MAX = 140;

export type DigestEmail = { subject: string; html: string; text: string };

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Stored Markdown as one line of plain text, cut to the excerpt length. */
function excerpt(body: string, recipient: { userId: string; name: string }) {
  const plain = body
    .replace(/<@([\w-]+)>/g, (_, id: string) =>
      id === 'channel' || id === 'here'
        ? `@${id}`
        : `@${id === recipient.userId ? recipient.name : 'someone'}`
    )
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>)\s?/gm, '')
    .replace(/(\*\*|__|~~|[*`])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = [...plain];
  return chars.length > EXCERPT_MAX
    ? `${chars.slice(0, EXCERPT_MAX).join('').trimEnd()}...`
    : plain;
}

const roomLabel = ({ roomKind, roomName }: DigestMention) =>
  roomKind === 'dm' ? 'a direct message' : `#${roomName}`;

/** The same link the Activity feed opens: the message in its conversation, or in its thread panel for a reply. */
function mentionHref(appUrl: string, mention: DigestMention) {
  const params = new URLSearchParams();
  if (mention.parentId) params.set('thread', mention.parentId);
  params.set('message', mention.messageId);
  const base = mention.roomKind === 'dm' ? 'dms' : 'channels';
  return `${appUrl}/${base}/${mention.roomId}?${params}`;
}

/** Up to 20 mentions, newest first, then "and N more". The footer links to the notification settings. */
export function buildDigestEmail({
  mentions,
  recipient,
  appUrl,
}: {
  mentions: DigestMention[];
  recipient: { userId: string; name: string };
  appUrl: string;
}): DigestEmail {
  const sorted = [...mentions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const shown = sorted.slice(0, DIGEST_MENTIONS_MAX);
  const more = sorted.length - shown.length;
  const [first] = sorted;
  const subject =
    sorted.length === 1 && first
      ? `${first.authorName} mentioned you in ${roomLabel(first)}`
      : `You have ${sorted.length} unread mentions on Conduit`;

  const rows = shown.map((mention) => ({
    heading: `${mention.authorName} in ${roomLabel(mention)}`,
    text: excerpt(mention.body, recipient),
    href: mentionHref(appUrl, mention),
  }));
  const activityHref = `${appUrl}/activity`;
  const settingsHref = `${appUrl}/settings/notifications`;
  const moreText = `and ${more} more`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.5;margin:0;padding:24px">
<p>Hi ${escapeHtml(recipient.name)}, you have unread mentions from while you were away.</p>
${rows
  .map(
    (row) =>
      `<p style="margin:16px 0 0"><strong>${escapeHtml(row.heading)}</strong><br>${escapeHtml(row.text)}<br><a href="${escapeHtml(row.href)}">Open message</a></p>`
  )
  .join('\n')}
${more > 0 ? `<p style="margin:16px 0 0"><a href="${escapeHtml(activityHref)}">${moreText}</a></p>` : ''}
<p style="margin:32px 0 0;font-size:13px;opacity:.7">You get this email after an hour away. <a href="${escapeHtml(settingsHref)}">Change it in your notification settings</a>.</p>
</body></html>`;

  const text = [
    `Hi ${recipient.name}, you have unread mentions from while you were away.`,
    ...rows.map((row) => `\n${row.heading}\n${row.text}\n${row.href}`),
    ...(more > 0 ? [`\n${moreText}: ${activityHref}`] : []),
    `\nYou get this email after an hour away. Change it in your notification settings: ${settingsHref}`,
  ].join('\n');

  return { subject, html, text };
}
