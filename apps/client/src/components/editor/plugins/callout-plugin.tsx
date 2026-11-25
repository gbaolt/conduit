'use client';

import {
  EmojiPicker,
  EmojiPickerCategories,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerHeader,
  EmojiPickerList,
  EmojiPickerSearch,
  EmojiPickerSkinTone,
  EmojiPickerTrigger,
} from '@conduit/ui/components/emoji-picker';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@conduit/ui/components/toggle-group';
import { Twemoji } from '@conduit/ui/components/twemoji';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $getNodeByKey, type LexicalEditor, type NodeKey } from 'lexical';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  $isCalloutNode,
  CALLOUT_TONES,
  CalloutNode,
  type CalloutTone,
} from '@/components/editor/nodes/callout-node';
import { cn } from '@/lib/utils';

type Callout = { icon: HTMLElement; emoji: string; tone: CalloutTone };

const TONE_SWATCHES: Record<CalloutTone, { label: string; className: string }> =
  {
    blue: { label: 'Blue', className: 'bg-blue-500' },
    green: { label: 'Green', className: 'bg-emerald-500' },
    yellow: { label: 'Yellow', className: 'bg-amber-500' },
    red: { label: 'Red', className: 'bg-red-500' },
    purple: { label: 'Purple', className: 'bg-violet-500' },
    gray: { label: 'Gray', className: 'bg-muted-foreground' },
  };

function $editCallout(key: NodeKey, edit: (node: CalloutNode) => void) {
  const node = $getNodeByKey(key);
  if ($isCalloutNode(node)) edit(node);
}

function CalloutIcon({
  editor,
  nodeKey,
  emoji,
  tone,
}: {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  emoji: string;
  tone: CalloutTone;
}) {
  const editable = useLexicalEditable();
  const icon = <Twemoji className="size-5">{emoji}</Twemoji>;
  if (!editable) return <span aria-hidden>{icon}</span>;

  const edit = (change: (node: CalloutNode) => void) =>
    editor.update(() => $editCallout(nodeKey, change));

  return (
    <EmojiPicker
      aria-label="Callout emoji"
      onEmojiSelect={({ value }) => edit((node) => node.setEmoji(value))}
    >
      <EmojiPickerTrigger
        variant="ghost"
        size="icon-sm"
        aria-label="Change callout emoji and color"
      >
        {icon}
      </EmojiPickerTrigger>
      <EmojiPickerContent>
        <EmojiPickerHeader>
          <EmojiPickerSearch />
        </EmojiPickerHeader>
        <EmojiPickerCategories />
        <EmojiPickerList />
        <EmojiPickerFooter>
          <ToggleGroup
            aria-label="Callout color"
            size="sm"
            spacing={1}
            value={[tone]}
            onValueChange={([next]) => {
              if (next) edit((node) => node.setTone(next as CalloutTone));
            }}
          >
            {CALLOUT_TONES.map((value) => (
              <ToggleGroupItem
                key={value}
                value={value}
                aria-label={TONE_SWATCHES[value].label}
                className="size-7 min-w-7 p-0"
              >
                <span
                  className={cn(
                    'size-3.5 rounded-full',
                    TONE_SWATCHES[value].className
                  )}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <EmojiPickerSkinTone className="ml-auto" />
        </EmojiPickerFooter>
      </EmojiPickerContent>
    </EmojiPicker>
  );
}

/** Draws each callout's emoji into the slot the node leaves for it, as a picker for editors. */
export function CalloutPlugin() {
  const [editor] = useLexicalComposerContext();
  const [callouts, setCallouts] = useState<ReadonlyMap<NodeKey, Callout>>(
    () => new Map()
  );

  useEffect(
    () =>
      editor.registerMutationListener(
        CalloutNode,
        (mutations) =>
          setCallouts((previous) => {
            const next = new Map(previous);
            editor.getEditorState().read(() => {
              for (const [key, mutation] of mutations) {
                const node = $getNodeByKey(key);
                const icon = editor
                  .getElementByKey(key)
                  ?.querySelector<HTMLElement>('[data-callout-icon]');
                if (
                  mutation === 'destroyed' ||
                  !$isCalloutNode(node) ||
                  !icon
                ) {
                  next.delete(key);
                } else {
                  next.set(key, {
                    icon,
                    emoji: node.getEmoji(),
                    tone: node.getTone(),
                  });
                }
              }
            });
            return next;
          }),
        { skipInitialization: false }
      ),
    [editor]
  );

  return [...callouts].map(([key, { icon, emoji, tone }]) =>
    createPortal(
      <CalloutIcon editor={editor} nodeKey={key} emoji={emoji} tone={tone} />,
      icon,
      key
    )
  );
}
