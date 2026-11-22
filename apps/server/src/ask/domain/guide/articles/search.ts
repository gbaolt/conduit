import type { GuideArticle } from '../guide';

export const search: GuideArticle = {
  slug: 'search',
  title: 'Search and the command menu',
  covers: ['M3.7', 'M3.8', 'M3.9', 'M3.10'],
  body: `Search finds messages, files, channels, and people. It only ever shows what you can open, so private channels you aren't in and other people's DMs never appear.

Narrow a search with filters typed into the search field:

- \`in:#channel\` searches one channel, and \`in:@person\` your DM with someone.
- \`from:@person\` finds what one person wrote.
- \`has:file\` finds messages with files.
- \`before:2026-01-31\` and \`after:2026-01-01\` limit the dates. Dates are written year-month-day.

Put a name with a space in quotes, as in \`from:@"Linh Pham"\`.

Press \`Ctrl+K\`, or \`⌘K\` on a Mac, to open the command menu and jump to any channel or DM by typing its name.`,
};
