import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@conduit/ui/components/command';
import { Twemoji } from '@conduit/ui/components/twemoji';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import type { TextNode } from 'lexical';
import { $createTextNode, $getSelection, $isRangeSelection } from 'lexical';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { MentionMenu } from '@/components/editor/plugins/mentions-plugin';
import { cn } from '@/lib/utils';

class EmojiOption extends MenuOption {
  constructor(
    readonly title: string,
    readonly emoji: string,
    readonly keywords: string[]
  ) {
    super(title);
  }
}

type Emoji = { emoji: string; aliases: string[]; tags: string[] };

const MAX_EMOJI_SUGGESTION_COUNT = 10;

/** Options whose shortcode or keyword contains the query, shortcodes that start with it first. */
export function matchEmojiOptions<
  T extends { title: string; keywords: string[] },
>(options: readonly T[], query: string) {
  const needle = query.toLowerCase();
  const starts: T[] = [];
  const contains: T[] = [];
  for (const option of options) {
    if (option.title.startsWith(needle)) starts.push(option);
    else if (option.keywords.some((keyword) => keyword.includes(needle))) {
      contains.push(option);
    }
  }
  return [...starts, ...contains].slice(0, MAX_EMOJI_SUGGESTION_COUNT);
}

/** Offers emoji after a `:` and two letters, as `:sm` does, and inserts the pick. */
export function EmojiPickerPlugin({
  onOpenChange,
}: {
  /** Whether the menu is showing, so the host can leave Enter and Escape to it. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [emojis, setEmojis] = useState<Emoji[]>([]);

  // The list is large, so it loads on the first `:`.
  const wanted = queryString !== null;
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    void import('@/components/editor/utils/emoji-list').then((file) => {
      if (!cancelled) setEmojis(file.default);
    });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  const emojiOptions = useMemo(
    () =>
      emojis.map(
        ({ emoji, aliases, tags }) =>
          new EmojiOption(aliases[0] ?? emoji, emoji, [...aliases, ...tags])
      ),
    [emojis]
  );

  // Two letters, so a bare `:` or a `:)` never takes Enter away from sending.
  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch(':', {
    minLength: 2,
  });

  const options = useMemo(
    () =>
      queryString === null ? [] : matchEmojiOptions(emojiOptions, queryString),
    [emojiOptions, queryString]
  );

  const showing = open && options.length > 0;
  const reportOpen = useEffectEvent((next: boolean) => onOpenChange?.(next));
  useEffect(() => reportOpen(showing), [showing]);

  const onSelectOption = useCallback(
    (
      selectedOption: EmojiOption,
      nodeToRemove: TextNode | null,
      closeMenu: () => void
    ) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        nodeToRemove?.remove();
        selection.insertNodes([$createTextNode(selectedOption.emoji)]);
        closeMenu();
      });
    },
    [editor]
  );

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setQueryString}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) =>
        anchorElementRef.current && options.length
          ? createPortal(
              <MentionMenu>
                <Command
                  className="min-h-0"
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
                      return;
                    }
                    event.preventDefault();
                    const step = event.key === 'ArrowUp' ? -1 : 1;
                    setHighlightedIndex(
                      ((selectedIndex ?? 0) + step + options.length) %
                        options.length
                    );
                  }}
                >
                  <CommandList className="max-h-none overflow-y-auto">
                    <CommandGroup>
                      {options.map((option, index) => (
                        <CommandItem
                          key={option.key}
                          value={option.title}
                          onSelect={() => selectOptionAndCleanUp(option)}
                          className={cn(
                            'flex items-center gap-2',
                            selectedIndex === index
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-transparent'
                          )}
                        >
                          <Twemoji className="m-0 size-5">
                            {option.emoji}
                          </Twemoji>
                          <span className="truncate">:{option.title}:</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </MentionMenu>,
              anchorElementRef.current
            )
          : null
      }
    />
  );
}
