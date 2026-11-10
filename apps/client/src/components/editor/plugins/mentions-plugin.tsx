import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@conduit/ui/components/command';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import type { TextNode } from 'lexical';
import {
  type JSX,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { $createMentionNode } from '@/components/editor/nodes/mention-node';
import { cn } from '@/lib/utils';

/** Who the menu can offer. `id` is a user id, or `channel` or `here`. */
export type MentionSuggestion = { id: string; name: string; hint?: string };

const SUGGESTION_LIST_LENGTH_LIMIT = 6;
const TRIGGER = /(^|\s|\()(@([^@\n]{0,50}))$/;

/** Suggestions whose name contains the query, name matches at the start first. */
export function matchSuggestions(
  source: readonly MentionSuggestion[],
  query: string
) {
  const needle = query.trim().toLowerCase();
  const starts: MentionSuggestion[] = [];
  const contains: MentionSuggestion[] = [];

  for (const suggestion of source) {
    const name = suggestion.name.toLowerCase();
    if (name.startsWith(needle)) starts.push(suggestion);
    else if (name.includes(needle)) contains.push(suggestion);
  }
  return [...starts, ...contains].slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
}

function triggerMatch(text: string): MenuTextMatch | null {
  const match = TRIGGER.exec(text);
  if (!match) return null;

  return {
    leadOffset: match.index + (match[1]?.length ?? 0),
    matchingString: match[3] ?? '',
    replaceableString: match[2] ?? '',
  };
}

const EDGE = 8;
const MAX_MENU_HEIGHT = 280;

type Placement = {
  above: boolean;
  maxHeight: number;
  shift: number;
  line: number;
};

/**
 * Lexical puts its anchor just under the caret line, with the line's height, and flips only when the editor
 * itself has room above the caret, which a one-line composer never has. So the menu sits in a zero-height box
 * that Lexical never flips, and places itself from the room left in the viewport.
 */
export function MentionMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>({
    above: false,
    maxHeight: MAX_MENU_HEIGHT,
    shift: 0,
    line: 0,
  });

  useLayoutEffect(() => {
    const menu = ref.current;
    const anchor = menu?.parentElement?.parentElement;
    if (!menu || !anchor) return;

    const place = () => {
      const line = anchor.getBoundingClientRect();
      const below = window.innerHeight - line.top - EDGE;
      // The caret line ends 3 px above the anchor.
      const above = line.top - line.height - 3 - EDGE;
      const wanted = Math.min(menu.scrollHeight, MAX_MENU_HEIGHT);
      const flip = below < wanted && above > below;
      const overflow =
        line.left + menu.offsetWidth - (window.innerWidth - EDGE);
      setPlacement({
        above: flip,
        maxHeight: Math.min(MAX_MENU_HEIGHT, flip ? above : below),
        shift: Math.min(Math.max(overflow, 0), Math.max(line.left - EDGE, 0)),
        line: line.height,
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  return (
    <div className="relative h-0">
      <div
        ref={ref}
        style={{
          maxHeight: placement.maxHeight,
          left: -placement.shift,
          ...(placement.above ? { bottom: placement.line + 6 } : { top: 0 }),
        }}
        className="bg-popover text-popover-foreground ring-foreground/10 absolute z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg shadow-md ring-1"
      >
        {children}
      </div>
    </div>
  );
}

class MentionOption extends MenuOption {
  constructor(readonly suggestion: MentionSuggestion) {
    super(suggestion.id);
  }
}

/** Offers `source` after an `@` and inserts the pick as a `MentionNode`. */
export function MentionsPlugin({
  source,
  onOpenChange,
}: {
  source: readonly MentionSuggestion[];
  /** Whether the menu is showing, so the host can leave Enter and Escape to it. */
  onOpenChange?: (open: boolean) => void;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () =>
      query === null
        ? []
        : matchSuggestions(source, query).map(
            (suggestion) => new MentionOption(suggestion)
          ),
    [source, query]
  );

  // Only a menu with something to pick takes Enter. With no match, Enter still sends.
  const showing = open && options.length > 0;
  const reportOpen = useEffectEvent((next: boolean) => onOpenChange?.(next));
  useEffect(() => reportOpen(showing), [showing]);

  const onSelectOption = useCallback(
    (
      option: MentionOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void
    ) => {
      editor.update(() => {
        const { id, name } = option.suggestion;
        const mention = $createMentionNode(name, id);
        nodeToReplace?.replace(mention);
        mention.select();
        closeMenu();
      });
    },
    [editor]
  );

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setQuery}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onSelectOption={onSelectOption}
      triggerFn={triggerMatch}
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
                          value={option.suggestion.name}
                          onSelect={() => selectOptionAndCleanUp(option)}
                          className={cn(
                            'flex items-baseline gap-2',
                            selectedIndex === index
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-transparent'
                          )}
                        >
                          <span className="truncate">
                            @{option.suggestion.name}
                          </span>
                          {option.suggestion.hint && (
                            <span className="text-muted-foreground truncate text-xs">
                              {option.suggestion.hint}
                            </span>
                          )}
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
