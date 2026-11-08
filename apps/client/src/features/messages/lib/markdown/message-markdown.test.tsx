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

describe('MessageMarkdown', () => {
  it('cannot forge a mention with raw HTML', () => {
    const html = render('<span data-mention="x">@boss</span>');

    expect(html).not.toContain('<span data-mention');
  });

  it('turns a single newline into a line break', () => {
    expect(render('one\ntwo')).toContain('one<br/>\ntwo');
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

  it('renders a mention that is the whole message', () => {
    for (const body of ['<@u1>', '<@channel>', '<@here>\n\nhi']) {
      expect(render(body, [['u1', 'Linh']])).not.toContain('&lt;@');
    }
  });

  it('leaves a mention inside code as typed', () => {
    expect(render('`<@u1>`', [['u1', 'Linh']])).toContain('&lt;@u1&gt;');
  });
});
