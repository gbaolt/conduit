import type { GuideArticle } from '../guide';

export const canvases: GuideArticle = {
  slug: 'canvases',
  title: 'Canvases',
  covers: ['M4.1', 'M4.2', 'M4.3', 'M4.4', 'M4.5', 'M4.6', 'M4.7'],
  body: `A canvas is a document your team edits together.

- **A channel's canvas.** Open a channel and choose the **Canvas** tab, then **Create canvas**. Everyone who can read the channel can read it, and everyone who can post there can edit it. An archived channel's canvas is read-only.
- **A canvas of your own.** Choose **Canvases** in the rail, then **New canvas**. Only the people you share it with can open it. Choose **Share** to add people as **Can edit** or **Can view**. A canvas always keeps at least one person who can edit it.
- **Writing.** Type \`/\` for headings, lists, checklists, quotes, code, dividers, tables, and columns. Select text to bold, italicize, or link it. Drag the handle beside a block to move it.
- **Mentions and checklists.** Type \`@\` to mention a member, and \`:\` for an emoji. Click a checklist box, or press Space on it, to tick it.
- **Editing together.** Everyone with the canvas open edits it at once. Each person's cursor shows in their own color with their name, and their avatar shows in the title bar. **Ctrl+Z** undoes only your own edits. People with **Can view** see edits and cursors live but cannot type. If the connection drops, a **Reconnecting** banner shows and editing pauses until it is back.
- **Comments.** Select text and choose **Comment** in the toolbar, or press **Ctrl+Alt+M**, to start a thread on it. The text stays highlighted, and clicking it opens the thread. **Comments** in the title bar opens every thread, filtered to **Open** or **Resolved**. Reply, edit or delete your own comments, and choose **Resolve** when a thread is done, or **Reopen** to bring it back. A resolved thread keeps the text it was about, even after that text is deleted. People with **Can view** read comments but cannot add them.
- **Embedded messages.** Choose **Copy link** in a message's menu and paste it into a canvas, or type \`/message\` and search for one, to show the message as a card with **Jump to message**. Each person sees the card only if they can read the message's channel or DM; anyone else sees **Message from a channel you cannot access**, and a deleted message shows **This message was deleted**.
- **Saving.** A canvas saves as you type, and the title bar shows **Saved** once it has.
- **Version history.** **History** in the title bar lists the canvas's versions, newest first. A version is kept automatically at most every 5 minutes while the canvas changes, and **Save version** keeps one right away under a name you choose. Click a version, or step through them with the arrow keys, to preview it read-only; **Escape** closes the preview. **Restore this version** makes it the canvas's content for everyone with it open, and first keeps the current content as a version named **Before restoring version**, so nothing is lost. People with **Can view**, and anyone on an archived channel's canvas, can browse history but cannot save or restore versions.
- **Turn a thread into a canvas.** When AI is on for the workspace, open a thread, choose the **Thread actions** menu in its header, then **Turn into canvas**. AI drafts a title, sections, and a checklist of action items from the thread, with numbered links to the messages each part came from and a **Sources** list at the end. Only you see the draft. Choose where it goes: **Channel canvas** (when the channel has none yet), **New channel canvas**, or **Standalone private canvas**, which is the only choice in a DM. **Create canvas** saves it and opens it, with the draft kept as the first version, labelled **AI draft** in **History**. Closing the dialog first saves nothing.

The **Canvases** page lists every canvas you can open, and filters to channel canvases or ones shared with you.`,
};
