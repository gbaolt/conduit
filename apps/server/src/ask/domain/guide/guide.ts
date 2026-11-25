import { accounts } from './articles/accounts';
import { activityAndNotifications } from './articles/activity-and-notifications';
import { aiPrivacy } from './articles/ai-privacy';
import { askConduit } from './articles/ask-conduit';
import { canvases } from './articles/canvases';
import { channels } from './articles/channels';
import { directMessages } from './articles/direct-messages';
import { files } from './articles/files';
import { invitations } from './articles/invitations';
import { membersAndRoles } from './articles/members-and-roles';
import { messages } from './articles/messages';
import { search } from './articles/search';
import { sidebar } from './articles/sidebar';
import { smartActivityAndCatchUp } from './articles/smart-activity-and-catch-up';
import { summaries } from './articles/summaries';
import { threads } from './articles/threads';
import { whatIsConduit } from './articles/what-is-conduit';
import { workspaces } from './articles/workspaces';

/** One article of the Conduit guide, which Ask Conduit reads for questions about the app itself. */
export type GuideArticle = {
  slug: string;
  title: string;
  /** The PRD rows the article describes, such as 'M3.5'. A test holds them to the PRD's Shipped rows. */
  covers: readonly string[];
  /** Markdown. Every number it states comes from a constant, so the article can't drift from the code. */
  body: string;
};

export const GUIDE: readonly GuideArticle[] = [
  whatIsConduit,
  accounts,
  workspaces,
  membersAndRoles,
  invitations,
  channels,
  sidebar,
  messages,
  threads,
  directMessages,
  files,
  canvases,
  search,
  activityAndNotifications,
  smartActivityAndCatchUp,
  summaries,
  askConduit,
  aiPrivacy,
];

/** Shipped PRD rows a member never sees, so no article covers them. */
export const NOT_IN_GUIDE: readonly string[] = ['F.5', 'F.7'];

const BY_SLUG = new Map(GUIDE.map((article) => [article.slug, article]));

export const guideArticle = (slug: string) => BY_SLUG.get(slug);

/** One line per article, for the system prompt. */
export const guideCatalog = () =>
  GUIDE.map((article) => `- ${article.slug}: ${article.title}`).join('\n');
