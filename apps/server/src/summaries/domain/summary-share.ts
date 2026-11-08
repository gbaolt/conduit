import { MESSAGE_BODY_MAX, type Summary } from '@conduit/contract';

/**
 * The Markdown a shared summary posts: one bullet per line, each followed by numbered links to its sources.
 * `path` is the conversation's page, such as `/channels/abc`. A bullet that would push the message past the
 * length limit is left out.
 */
export function summaryMessageBody(summary: Summary, path: string) {
  const query = (messageId: string) =>
    summary.parentId
      ? `?thread=${summary.parentId}&message=${messageId}`
      : `?message=${messageId}`;

  const heading = `**Summary of ${summary.messageCount} ${
    summary.messageCount === 1 ? 'message' : 'messages'
  }** (written by AI)`;
  let body = heading;

  for (const bullet of summary.bullets) {
    const links = bullet.sourceIds
      .map(
        (id) =>
          `[${summary.sourceMessageIds.indexOf(id) + 1}](${path}${query(id)})`
      )
      .join(' ');
    const line = `${body === heading ? '\n\n' : '\n'}- ${bullet.text.replace(/\s*\n\s*/g, ' ')} ${links}`;
    if (body.length + line.length > MESSAGE_BODY_MAX) break;
    body += line;
  }

  return body;
}
