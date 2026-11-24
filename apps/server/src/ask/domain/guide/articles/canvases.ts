import type { GuideArticle } from '../guide';

export const canvases: GuideArticle = {
  slug: 'canvases',
  title: 'Canvases',
  covers: ['M4.1', 'M4.2', 'M4.3', 'M4.4', 'M4.5'],
  body: `A canvas is a document your team edits together.

- **A channel's canvas.** Open a channel and choose the **Canvas** tab, then **Create canvas**. Everyone who can read the channel can read it, and everyone who can post there can edit it. An archived channel's canvas is read-only.
- **A canvas of your own.** Choose **Canvases** in the rail, then **New canvas**. Only the people you share it with can open it. Choose **Share** to add people as **Can edit** or **Can view**. A canvas always keeps at least one person who can edit it.
- **Writing.** Type \`/\` for headings, lists, checklists, quotes, code, dividers, tables, and columns. Select text to bold, italicize, or link it. Drag the handle beside a block to move it.
- **Mentions and checklists.** Type \`@\` to mention a member, and \`:\` for an emoji. Click a checklist box, or press Space on it, to tick it.
- **Editing together.** Everyone with the canvas open edits it at once. Each person's cursor shows in their own color with their name, and their avatar shows in the title bar. **Ctrl+Z** undoes only your own edits. People with **Can view** see edits and cursors live but cannot type. If the connection drops, a **Reconnecting** banner shows and editing pauses until it is back.
- **Comments.** Select text and choose **Comment** in the toolbar, or press **Ctrl+Alt+M**, to start a thread on it. The text stays highlighted, and clicking it opens the thread. **Comments** in the title bar opens every thread, filtered to **Open** or **Resolved**. Reply, edit or delete your own comments, and choose **Resolve** when a thread is done, or **Reopen** to bring it back. A resolved thread keeps the text it was about, even after that text is deleted. People with **Can view** read comments but cannot add them.
- **Embedded messages.** Choose **Copy link** in a message's menu and paste it into a canvas, or type \`/message\` and search for one, to show the message as a card with **Jump to message**. Each person sees the card only if they can read the message's channel or DM; anyone else sees **Message from a channel you cannot access**, and a deleted message shows **This message was deleted**.
- **Saving.** A canvas saves as you type, and the title bar shows **Saved** once it has.

The **Canvases** page lists every canvas you can open, and filters to channel canvases or ones shared with you.`,
};
