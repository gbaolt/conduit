import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CodeBlock, CodeBlockContent } from '@/components/code-block';

import {
  SNIPPET_LINE_MAX,
  snippetLanguage,
  snippetPreview,
} from '../snippet-preview';

describe('snippetPreview', () => {
  it('shows a short file whole', () => {
    expect(snippetPreview('a\nb\n', false)).toEqual({
      code: 'a\nb',
      more: false,
    });
  });

  it('shows the first 8 lines of a longer one, and says there is more', () => {
    const text = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n');
    const { code, more } = snippetPreview(text, false);
    expect(code.split('\n')).toHaveLength(8);
    expect(code.split('\n')[7]).toBe('line 7');
    expect(more).toBe(true);
  });

  it('cuts a minified line', () => {
    const { code, more } = snippetPreview('x'.repeat(5000), false);
    expect(code).toHaveLength(SNIPPET_LINE_MAX + 1);
    expect(more).toBe(true);
  });

  it('says there is more when the server sent only the start', () => {
    expect(snippetPreview('a', true).more).toBe(true);
  });

  it('reads Windows line endings as one break', () => {
    expect(snippetPreview('a\r\nb', false).code).toBe('a\nb');
  });
});

describe('snippetLanguage', () => {
  it('takes the extension, and nothing from a name without one', () => {
    expect(snippetLanguage('Snippet.TS')).toBe('ts');
    expect(snippetLanguage('Makefile')).toBeUndefined();
    expect(snippetLanguage('.env')).toBeUndefined();
  });
});

describe('a snippet rendered in a message', () => {
  it('shows markup in the file as text, never as elements', () => {
    const text = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const html = renderToStaticMarkup(
      <CodeBlock>
        <CodeBlockContent
          code={snippetPreview(text, false).code}
          language="html"
        />
      </CodeBlock>
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });
});
