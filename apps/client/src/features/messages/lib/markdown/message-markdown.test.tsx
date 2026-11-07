import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MentionNames } from '@/features/messages/context/mention-names';

import { MessageMarkdown } from './message-markdown';

function render(body: string, names: [string, string][] = []) {
  return renderToStaticMarkup(
    <MentionNames value={new Map(names)}>
      <MessageMarkdown id="m1" updatedAt={new Date(0)} body={body} />
    </MentionNames>
  );
}

describe('MessageMarkdown inert content', () => {
  it('shows a script tag as text', () => {
    const html = render('<script>alert(1)</script>');

    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('shows an img with an onerror attribute as text', () => {
    const html = render('<img src=x onerror=alert(1)>');

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('drops the href of a javascript: link', () => {
    const html = render('[click](javascript:alert(1))');

    expect(html).not.toContain('javascript:');
    expect(html).toContain('click');
  });

  it('drops the href of a javascript: autolink in mixed case', () => {
    const html = render('[x](JaVaScRiPt:alert(1)) [y](data:text/html,<b>)');

    expect(html).not.toMatch(/href="(javascript|data):/i);
  });

  it('keeps an event handler out of an inline element', () => {
    const html = render(
      '<a href="https://example.com" onclick="alert(1)">x</a>'
    );

    expect(html).not.toMatch(/<a [^>]*onclick/);
  });

  it('does not render a markdown image', () => {
    expect(render('![alt](https://example.com/a.png)')).not.toContain('<img');
  });

  it('cannot forge a mention with raw HTML', () => {
    const html = render('<span data-mention="x">@boss</span>');

    expect(html).not.toContain('<span data-mention');
  });
});

describe('MessageMarkdown rendering', () => {
  it('opens external links in a new tab without a referrer path to the opener', () => {
    const html = render('[site](https://example.com)');

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener nofollow"');
  });

  it('renders a heading as a bold paragraph', () => {
    const html = render('# Title');

    expect(html).not.toContain('<h1');
    expect(html).toContain('<p class="font-semibold">Title</p>');
  });

  it('turns a single newline into a line break', () => {
    expect(render('one\ntwo')).toContain('one<br/>\ntwo');
  });

  it('renders bold, strikethrough, inline code, and lists', () => {
    const html = render('**b** ~~s~~ `c`\n\n- one\n- two');

    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('<del>s</del>');
    expect(html).toContain('<code');
    expect(html).toContain('<ul');
  });

  it('renders a fenced block through the code block with its raw text', () => {
    const html = render('```ts\nconst a = 1;\n```');

    expect(html).toContain('data-slot="code-block"');
    expect(html).toContain('const a = 1;');
    expect(html).toContain('>ts<');
  });

  it('names a mentioned member and keeps @channel and @here', () => {
    const html = render('hi <@u1> and <@channel> and <@here> and <@ghost>', [
      ['u1', 'Linh Tran'],
    ]);

    expect(html).toContain('@Linh Tran');
    expect(html).toContain('@channel');
    expect(html).toContain('@here');
    expect(html).toContain('@unknown member');
  });

  it('leaves a mention inside code as typed', () => {
    expect(render('`<@u1>`', [['u1', 'Linh']])).toContain('&lt;@u1&gt;');
  });
});
