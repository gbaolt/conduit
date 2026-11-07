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
import { type JSX, useCallback, useMemo, useState } from 'react';
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

class MentionOption extends MenuOption {
  constructor(readonly suggestion: MentionSuggestion) {
    super(suggestion.id);
  }
}

/** Offers `source` after an `@` and inserts the pick as a `MentionNode`. */
export function MentionsPlugin({
  source,
}: {
  source: readonly MentionSuggestion[];
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  const options = useMemo(
    () =>
      query === null
        ? []
        : matchSuggestions(source, query).map(
            (suggestion) => new MentionOption(suggestion)
          ),
    [source, query]
  );

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
      onSelectOption={onSelectOption}
      triggerFn={triggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) =>
        anchorElementRef.current && options.length
          ? createPortal(
              <div className="bg-popover text-popover-foreground absolute z-50 w-64 rounded-md border shadow-md">
                <Command
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
                  <CommandList>
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
              </div>,
              anchorElementRef.current
            )
          : null
      }
    />
  );
}
