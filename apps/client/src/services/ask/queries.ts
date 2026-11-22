import { orpc } from '@/lib/orpc';

/** The viewer's newest chats with Ask Conduit. */
export const askChatsQuery = orpc.ask.chats.queryOptions();

/** One chat's answers, oldest first, with sources read through the viewer's access now. */
export const askChatQuery = (chatId: string) =>
  orpc.ask.chat.queryOptions({ input: { chatId } });
