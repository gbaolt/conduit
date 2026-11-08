import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  HttpLinkPreviewFetcher,
  isPublicAddress,
  MAX_BYTES,
  MAX_REDIRECTS,
  parsePreview,
} from './link-preview.fetcher';

describe('isPublicAddress', () => {
  it.each([
    ['loopback', '127.0.0.1'],
    ['the rest of 127/8', '127.8.9.10'],
    ['unspecified', '0.0.0.0'],
    ['10/8', '10.1.2.3'],
    ['172.16/12 low edge', '172.16.0.1'],
    ['172.16/12 high edge', '172.31.255.255'],
    ['192.168/16', '192.168.1.1'],
    ['link-local', '169.254.1.1'],
    ['the cloud metadata address', '169.254.169.254'],
    ['carrier-grade NAT', '100.64.0.1'],
    ['benchmarking', '198.18.0.1'],
    ['multicast', '224.0.0.1'],
    ['reserved', '240.0.0.1'],
    ['broadcast', '255.255.255.255'],
    ['IPv6 loopback', '::1'],
    ['IPv6 unspecified', '::'],
    ['IPv6 unique local', 'fd12:3456:789a::1'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv6 multicast', 'ff02::1'],
    ['IPv4-mapped loopback, dotted', '::ffff:127.0.0.1'],
    ['IPv4-mapped loopback, hex', '::ffff:7f00:1'],
    ['IPv4-mapped metadata address', '::ffff:169.254.169.254'],
    ['NAT64', '64:ff9b::7f00:1'],
    ['6to4', '2002:7f00:1::'],
    ['not an address', 'example.com'],
  ])('refuses %s', (_name, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.1',
    '2606:4700:4700::1111',
  ])('allows the public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe('parsePreview', () => {
  const page = new URL('https://example.com/post/1');

  it('reads Open Graph tags and decodes entities', () => {
    const html = `<head>
      <meta property="og:title" content="Tom &amp; Jerry &#39;24">
      <meta property="og:description" content="A   long
        description">
      <meta property="og:site_name" content="Cartoons">
      <meta property="og:image" content="/img/cover.png">
    </head>`;

    expect(parsePreview(html, page, 'https://example.com/post/1')).toEqual({
      url: 'https://example.com/post/1',
      siteName: 'Cartoons',
      title: "Tom & Jerry '24",
      description: 'A long description',
      image: 'https://example.com/img/cover.png',
    });
  });

  it('falls back to the title tag and the description meta', () => {
    const html =
      '<head><title>Plain page</title><meta name="description" content="Plain text"></head>';

    expect(parsePreview(html, page, page.href)).toMatchObject({
      title: 'Plain page',
      description: 'Plain text',
      image: null,
      siteName: null,
    });
  });

  it('drops an image that is not http or https', () => {
    const html =
      '<meta property="og:title" content="t"><meta property="og:image" content="javascript:alert(1)">';

    expect(parsePreview(html, page, page.href)?.image).toBeNull();
  });

  it('has no preview without a title', () => {
    expect(parsePreview('<head></head>', page, page.href)).toBeNull();
  });
});

describe('HttpLinkPreviewFetcher', () => {
  let server: Server;
  let origin: string;
  let hits = 0;
  let handler: Parameters<typeof createServer>[1];

  const local = (ip: string) => ip === '127.0.0.1';
  const fetcher = new HttpLinkPreviewFetcher({
    allow: local,
    timeoutMs: 300,
  });

  beforeAll(async () => {
    server = createServer((req, res) => {
      hits += 1;
      handler?.(req, res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    hits = 0;
  });

  const html = (body: string) =>
    ((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(body);
    }) satisfies typeof handler;

  it('reads the preview of a public page', async () => {
    handler = html('<meta property="og:title" content="Hello">');

    await expect(fetcher.fetch(`${origin}/`)).resolves.toMatchObject({
      title: 'Hello',
    });
  });

  it.each([
    ['the cloud metadata address', 'http://169.254.169.254/latest/meta-data/'],
    ['a private address', 'http://10.0.0.5/'],
    ['an IPv6 loopback address', 'http://[::1]/'],
    ['an IPv4-mapped loopback address', 'http://[::ffff:7f00:1]/'],
    ['a loopback address in decimal form', 'http://2130706433/'],
  ])('refuses %s with the default guard', async (_name, url) => {
    const strict = new HttpLinkPreviewFetcher({ timeoutMs: 300 });

    await expect(strict.fetch(url)).resolves.toBeNull();
  });

  it('never connects to a host that resolves to a loopback address', async () => {
    handler = html('<meta property="og:title" content="Inside">');
    const strict = new HttpLinkPreviewFetcher({ timeoutMs: 1000 });
    const port = new URL(origin).port;

    await expect(strict.fetch(`http://localhost:${port}/`)).resolves.toBeNull();
    expect(hits).toBe(0);
  });

  it('refuses a scheme other than http and https', async () => {
    await expect(fetcher.fetch('file:///etc/passwd')).resolves.toBeNull();
    await expect(fetcher.fetch('ftp://127.0.0.1/')).resolves.toBeNull();
  });

  it('follows a redirect to another allowed address', async () => {
    handler = (req, res) => {
      if (req.url === '/start') {
        res.statusCode = 302;
        res.setHeader('location', '/end');
        res.end();
        return;
      }
      html('<meta property="og:title" content="Landed">')(req, res);
    };

    await expect(fetcher.fetch(`${origin}/start`)).resolves.toMatchObject({
      title: 'Landed',
    });
  });

  it('refuses a redirect into a private address', async () => {
    handler = (_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', 'http://169.254.169.254/latest/meta-data/');
      res.end();
    };

    await expect(fetcher.fetch(`${origin}/`)).resolves.toBeNull();
    expect(hits).toBe(1);
  });

  it('gives up after too many redirects', async () => {
    handler = (_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', '/again');
      res.end();
    };

    await expect(fetcher.fetch(`${origin}/`)).resolves.toBeNull();
    expect(hits).toBe(MAX_REDIRECTS + 1);
  });

  it('reads no more than the byte cap', async () => {
    handler = html(
      `<meta property="og:title" content="First">${' '.repeat(MAX_BYTES)}<meta property="og:description" content="Late">`
    );

    const preview = await fetcher.fetch(`${origin}/`);

    expect(preview).toMatchObject({ title: 'First', description: null });
  });

  it('gives up on a server that never answers', async () => {
    handler = () => undefined;
    const started = Date.now();

    await expect(fetcher.fetch(`${origin}/`)).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('gives up on a server that stalls partway through the body', async () => {
    handler = (_req, res) => {
      res.setHeader('content-type', 'text/html');
      res.write('<meta property="og:title" content="Half">');
    };

    await expect(fetcher.fetch(`${origin}/`)).resolves.toBeNull();
  });

  it('has no preview for a page that is not HTML', async () => {
    handler = (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end('{"title":"x"}');
    };

    await expect(fetcher.fetch(`${origin}/`)).resolves.toBeNull();
  });

  it('has no preview for an error page', async () => {
    handler = (_req, res) => {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/html');
      res.end('<title>Not found</title>');
    };

    await expect(fetcher.fetch(`${origin}/`)).resolves.toBeNull();
  });
});
