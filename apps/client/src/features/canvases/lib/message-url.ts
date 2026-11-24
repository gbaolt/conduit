const CONVERSATION = /^\/(?:channels|dms)\/[^/]+\/?$/;

/**
 * The id of the message a Conduit link points at, or null for any other text. A thread link without `message`
 * points at the thread's first message. Only a link on `origin`, the app's own, counts.
 */
export function parseMessageUrl(text: string, origin: string) {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.origin !== origin || !CONVERSATION.test(url.pathname)) return null;
  return url.searchParams.get('message') || url.searchParams.get('thread');
}
