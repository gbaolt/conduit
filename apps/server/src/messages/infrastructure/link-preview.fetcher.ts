import dns from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import net from 'node:net';

import type { LinkPreview } from '@conduit/contract';

import type { LinkPreviewFetcher } from '@/messages/domain/link-preview.fetcher';

export const MAX_REDIRECTS = 3;
export const MAX_BYTES = 512 * 1024;
export const TIMEOUT_MS = 3000;

// Loopback, private, link-local (the cloud metadata address is 169.254.169.254), shared, multicast, and reserved ranges.
const NON_PUBLIC: [string, number, 'ipv4' | 'ipv6'][] = [
  ['0.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.0.0.0', 24, 'ipv4'],
  ['192.0.2.0', 24, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'],
  ['198.51.100.0', 24, 'ipv4'],
  ['203.0.113.0', 24, 'ipv4'],
  ['224.0.0.0', 4, 'ipv4'],
  ['240.0.0.0', 4, 'ipv4'],
  ['::', 96, 'ipv6'],
  ['64:ff9b::', 96, 'ipv6'],
  ['100::', 64, 'ipv6'],
  ['2001::', 32, 'ipv6'],
  ['2001:db8::', 32, 'ipv6'],
  ['2002::', 16, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
  ['fec0::', 10, 'ipv6'],
  ['ff00::', 8, 'ipv6'],
];

const nonPublic = new net.BlockList();
for (const [address, prefix, family] of NON_PUBLIC) {
  nonPublic.addSubnet(address, prefix, family);
}

/** True for a globally routable address. An IPv4 address written as IPv6 is judged as the IPv4 address. */
export function isPublicAddress(address: string) {
  const family = net.isIP(address);
  if (family === 0) return false;
  return !nonPublic.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

class RefusedError extends Error {}

/**
 * Resolves the host and refuses it when any address is not allowed. The socket then connects to
 * an address checked here, so a host cannot answer the check with one address and the connection with another.
 */
function guardedLookup(
  allow: (address: string) => boolean
): net.LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, '', 0);
      if (addresses.length === 0 || !addresses.every((a) => allow(a.address))) {
        return callback(new RefusedError(`${hostname} is not public`), '', 0);
      }
      if (options.all) return callback(null, addresses);
      const [first] = addresses;
      return callback(null, first!.address, first!.family);
    });
  };
}

type Page =
  | { kind: 'redirect'; location: string }
  | { kind: 'html'; html: string; contentType: string };

function readPage(
  url: URL,
  allow: (address: string) => boolean,
  signal: AbortSignal
): Promise<Page | null> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !allow(host)) {
    return Promise.reject(new RefusedError(`${host} is not public`));
  }

  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), {
      once: true,
    });
    const request = (url.protocol === 'https:' ? https : http).request(
      url,
      {
        method: 'GET',
        signal,
        lookup: guardedLookup(allow),
        headers: {
          'user-agent': 'ConduitLinkPreview/1.0',
          accept: 'text/html,application/xhtml+xml',
          // A compressed body could expand far past the byte cap.
          'accept-encoding': 'identity',
        },
      },
      (response: IncomingMessage) => {
        const { statusCode = 0, headers } = response;

        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume();
          return resolve({ kind: 'redirect', location: headers.location });
        }
        const contentType = headers['content-type'] ?? '';
        if (statusCode !== 200 || !/\b(html|xhtml)\b/i.test(contentType)) {
          response.destroy();
          return resolve(null);
        }

        const chunks: Buffer[] = [];
        let total = 0;
        const finish = () =>
          resolve({
            kind: 'html',
            html: decode(Buffer.concat(chunks), contentType),
            contentType,
          });

        response.on('data', (chunk: Buffer) => {
          const room = MAX_BYTES - total;
          chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
          total += chunk.length;
          if (total >= MAX_BYTES) {
            response.destroy();
            finish();
          }
        });
        response.on('end', finish);
        response.on('error', reject);
        response.on('close', () => {
          if (!response.complete && total < MAX_BYTES) {
            reject(new Error('Connection closed early'));
          }
        });
      }
    );
    request.on('error', reject);
    request.end();
  });
}

function decode(body: Buffer, contentType: string) {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string) {
  return text.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (whole, entity: string) => {
      if (entity.startsWith('#')) {
        const code =
          entity[1]?.toLowerCase() === 'x'
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : whole;
      }
      return ENTITIES[entity.toLowerCase()] ?? whole;
    }
  );
}

const clean = (text: string | undefined, max: number) => {
  const value = decodeEntities(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return value ? value.slice(0, max) : null;
};

const ATTRIBUTE = /([^\s=/"'>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/** The Open Graph title, description, image, and site name of a page, with Twitter card and plain tags as fallbacks. */
export function parsePreview(
  html: string,
  pageUrl: URL,
  linkUrl: string
): LinkPreview | null {
  const end = html.search(/<\/head>/i);
  const head = end === -1 ? html : html.slice(0, end);

  const meta = new Map<string, string>();
  for (const [, attributes = ''] of head.matchAll(/<meta\s+([^>]*)>/gi)) {
    const found: Record<string, string> = {};
    for (const [, name = '', quoted, single, bare] of attributes.matchAll(
      ATTRIBUTE
    )) {
      found[name.toLowerCase()] = quoted ?? single ?? bare ?? '';
    }
    const key = (found.property ?? found.name)?.toLowerCase();
    if (key && found.content !== undefined && !meta.has(key)) {
      meta.set(key, found.content);
    }
  }

  const title = clean(
    meta.get('og:title') ??
      meta.get('twitter:title') ??
      /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1],
    200
  );
  if (!title) return null;

  return {
    url: linkUrl,
    siteName: clean(meta.get('og:site_name'), 100),
    title,
    description: clean(
      meta.get('og:description') ??
        meta.get('twitter:description') ??
        meta.get('description'),
      300
    ),
    image: publicImage(
      meta.get('og:image') ?? meta.get('twitter:image'),
      pageUrl
    ),
  };
}

function publicImage(value: string | undefined, base: URL) {
  if (!value) return null;
  try {
    const image = new URL(decodeEntities(value).trim(), base);
    return image.protocol === 'http:' || image.protocol === 'https:'
      ? image.href
      : null;
  } catch {
    return null;
  }
}

/**
 * Fetches a page for its preview. It resolves the host first and refuses any address that is not public,
 * follows at most 3 redirects with the same check, reads at most 512 KB, and gives up after 3 s in all.
 */
export class HttpLinkPreviewFetcher implements LinkPreviewFetcher {
  private readonly allow: (address: string) => boolean;
  private readonly timeoutMs: number;

  /** Tests widen `allow` to reach a local server and shorten `timeoutMs`. */
  constructor(
    options: {
      allow?: (address: string) => boolean;
      timeoutMs?: number;
    } = {}
  ) {
    this.allow = options.allow ?? isPublicAddress;
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  }

  async fetch(link: string): Promise<LinkPreview | null> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      let url = new URL(link);

      for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

        const page = await readPage(url, this.allow, signal);
        if (!page) return null;
        if (page.kind === 'html') return parsePreview(page.html, url, link);

        url = new URL(page.location, url);
      }
      return null;
    } catch {
      return null;
    }
  }
}
