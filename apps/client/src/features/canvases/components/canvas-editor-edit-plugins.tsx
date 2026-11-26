'use client';

import type { CanvasDocument } from '@conduit/contract';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { useQuery } from '@tanstack/react-query';
import { $getRoot, $getSelection } from 'lexical';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { $createMessageEmbedNode } from '@/components/editor/nodes/message-embed-node';
import { ComponentPickerMenuPlugin } from '@/components/editor/plugins/component-picker-menu-plugin';
import { DraggableBlockPlugin } from '@/components/editor/plugins/draggable-block-plugin';
import { EmojiPickerPlugin } from '@/components/editor/plugins/emoji-picker-plugin';
import { FloatingLinkEditorPlugin } from '@/components/editor/plugins/floating-link-editor-plugin';
import { FloatingTextFormatToolbarPlugin } from '@/components/editor/plugins/floating-text-format-plugin';
import { InsertBarPlugin } from '@/components/editor/plugins/insert-bar-plugin';
import {
  Mention,
  MentionAvatar,
  MentionContent,
  MentionFooter,
  MentionHint,
  MentionItem,
  MentionLabel,
  MentionPortal,
} from '@/components/editor/plugins/mentions-plugin';
import { BulletedListPickerPlugin } from '@/components/editor/plugins/picker/bulleted-list-picker-plugin';
import { CalloutPickerPlugin } from '@/components/editor/plugins/picker/callout-picker-plugin';
import { CheckListPickerPlugin } from '@/components/editor/plugins/picker/check-list-picker-plugin';
import { CodePickerPlugin } from '@/components/editor/plugins/picker/code-picker-plugin';
import { ColumnsLayoutPickerPlugin } from '@/components/editor/plugins/picker/columns-layout-picker-plugin';
import { DividerPickerPlugin } from '@/components/editor/plugins/picker/divider-picker-plugin';
import { HeadingPickerPlugin } from '@/components/editor/plugins/picker/heading-picker-plugin';
import { MessageEmbedPickerPlugin } from '@/components/editor/plugins/picker/message-embed-picker-plugin';
import { NumberedListPickerPlugin } from '@/components/editor/plugins/picker/numbered-list-picker-plugin';
import { ParagraphPickerPlugin } from '@/components/editor/plugins/picker/paragraph-picker-plugin';
import { QuotePickerPlugin } from '@/components/editor/plugins/picker/quote-picker-plugin';
import {
  DynamicTablePickerPlugin,
  TablePickerPlugin,
} from '@/components/editor/plugins/picker/table-picker-plugin';
import { TogglePickerPlugin } from '@/components/editor/plugins/picker/toggle-picker-plugin';
import { sessionQuery } from '@/services/auth/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import { useOpenedOnce } from '../hooks/use-opened-once';
import { CanvasCommentPopoverButton } from './canvas-comment-popover-button';

const CanvasMessagePickerDialog = dynamic(
  () =>
    import('./canvas-message-picker-dialog').then(
      (module) => module.CanvasMessagePickerDialog
    ),
  { ssr: false }
);

/** The `/` menu, in the order a document is usually built. */
function canvasBlockOptions(pickMessage: () => void) {
  return [
    ParagraphPickerPlugin(),
    HeadingPickerPlugin({ n: 1 }),
    HeadingPickerPlugin({ n: 2 }),
    HeadingPickerPlugin({ n: 3 }),
    BulletedListPickerPlugin(),
    NumberedListPickerPlugin(),
    CheckListPickerPlugin(),
    QuotePickerPlugin(),
    CalloutPickerPlugin(),
    TogglePickerPlugin(),
    CodePickerPlugin(),
    DividerPickerPlugin(),
    TablePickerPlugin(),
    ColumnsLayoutPickerPlugin(),
    MessageEmbedPickerPlugin({ onSelect: pickMessage }),
  ];
}

function $insertMessageEmbed(messageId: string) {
  // Closing a dialog leaves the editor blurred with no active selection.
  if (!$getSelection()) $getRoot().selectEnd();
  $insertNodeToNearestRoot($createMessageEmbedNode(messageId));
}

const INSERT_BAR_QUICK = ['Check List', 'Table', 'Columns Layout'];

/** The plugins only an editor uses, loaded apart so a reader never downloads the pickers and menus. */
export function CanvasEditorEditPlugins({
  canvas,
  anchor,
  insertBarSlot,
}: {
  canvas: CanvasDocument;
  anchor: HTMLDivElement | null;
  insertBarSlot: HTMLElement | null;
}) {
  const [editor] = useLexicalComposerContext();
  const [isLinkEditMode, setIsLinkEditMode] = useState(false);
  const [pickingMessage, setPickingMessage] = useState(false);
  const pickerOpened = useOpenedOnce(pickingMessage);
  const { data: session } = useQuery(sessionQuery);
  const { data: workspaceMembers } = useWorkspaceMembers();
  const blockOptions = useMemo(
    () => canvasBlockOptions(() => setPickingMessage(true)),
    []
  );
  const viewerId = session?.user.id;
  // A canvas never notifies a whole channel, so `@channel` and `@here` are not offered.
  const suggestions = useMemo(
    () =>
      (workspaceMembers ?? [])
        .filter((member) => member.status === 'active')
        .map(({ userId, name, email, image }) => ({
          id: userId,
          name,
          detail: email,
          image,
          hint: userId === viewerId ? 'You' : undefined,
        })),
    [workspaceMembers, viewerId]
  );

  return (
    <>
      <Mention source={suggestions}>
        <MentionPortal>
          <MentionContent>
            {() => (
              <MentionItem>
                <MentionAvatar />
                <MentionLabel />
                <MentionHint />
              </MentionItem>
            )}
          </MentionContent>
          <MentionFooter />
        </MentionPortal>
      </Mention>
      <EmojiPickerPlugin />
      <ComponentPickerMenuPlugin
        baseOptions={blockOptions}
        dynamicOptionsFn={DynamicTablePickerPlugin}
      />
      <FloatingTextFormatToolbarPlugin
        anchorElem={anchor}
        setIsLinkEditMode={setIsLinkEditMode}
        trailing={canvas.access.comment && <CanvasCommentPopoverButton />}
      />
      <FloatingLinkEditorPlugin
        anchorElem={anchor}
        isLinkEditMode={isLinkEditMode}
        setIsLinkEditMode={setIsLinkEditMode}
      />
      <DraggableBlockPlugin
        anchorElem={anchor}
        baseOptions={blockOptions}
        dynamicOptionsFn={DynamicTablePickerPlugin}
      />
      <InsertBarPlugin
        slot={insertBarSlot}
        options={blockOptions}
        quick={INSERT_BAR_QUICK}
      />
      {pickerOpened && (
        <CanvasMessagePickerDialog
          open={pickingMessage}
          onOpenChange={setPickingMessage}
          onPick={(messageId) =>
            editor.update(() => $insertMessageEmbed(messageId))
          }
        />
      )}
    </>
  );
}
