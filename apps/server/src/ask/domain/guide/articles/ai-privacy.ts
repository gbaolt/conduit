import type { GuideArticle } from '../guide';

export const aiPrivacy: GuideArticle = {
  slug: 'ai-privacy',
  title: 'AI and your privacy',
  covers: ['M1.19'],
  body: `The rules every AI feature in Conduit follows:

- The AI reads only what the member who asked can read.
- What the AI writes is shown only to the member who asked.
- Every summary and answer links to the messages it used.
- Conduit never uses workspace data to train a model.

**Turning AI off.** An admin can turn every AI feature off for the whole workspace under **Settings > AI**. Summaries, Smart Activity, Catch me up, and Ask Conduit then disappear for everyone. Ask an admin if you want it changed.`,
};
