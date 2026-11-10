import * as Primitives from '@conduit/ui/components/mention';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { IconSpeakerphone } from '@tabler/icons-react';
import type { TextNode } from 'lexical';
import {
  type ComponentProps,
  createContext,
  type JSX,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { $createMentionNode } from '@/components/editor/nodes/mention-node';
import { UserAvatar } from '@/components/user-avatar';

/** Who the menu can offer. `id` is a user id, or `channel` or `here`. */
export type MentionSuggestion = {
  id: string;
  name: string;
  /** Muted text at the row's end, as "You" is. */
  hint?: string;
  /** Shown in full under the list while the row is highlighted: a member's email, or what a broadcast does. */
  detail?: string;
  image?: string | null;
};

const BROADCASTS = new Set(['channel', 'here']);

const labelOf = ({ id, name }: MentionSuggestion) =>
  BROADCASTS.has(id) ? `@${name}` : name;

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

type MentionMenuState = {
  anchor: HTMLElement;
  options: MentionOption[];
  selectedIndex: number | null;
  select: (option: MentionOption) => void;
  highlight: (index: number) => void;
};

const MentionMenuContext = createContext<MentionMenuState | null>(null);
const MentionItemContext = createContext<{
  option: MentionOption;
  index: number;
} | null>(null);

function useMentionMenu() {
  const menu = use(MentionMenuContext);
  if (!menu) throw new Error('Mention parts must sit inside <Mention>.');
  return menu;
}

function useMentionItem() {
  const item = use(MentionItemContext);
  if (!item)
    throw new Error('Mention item parts must sit inside <MentionItem>.');
  return item;
}

/** Offers `source` after an `@` and inserts the pick as a `MentionNode`. `children` render the open menu. */
export function Mention({
  source,
  onOpenChange,
  children,
}: {
  source: readonly MentionSuggestion[];
  /** Whether the menu is showing, so the host can leave Enter and Escape to it. */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
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
        anchorElementRef.current && options.length ? (
          <MentionMenuContext
            value={{
              anchor: anchorElementRef.current,
              options,
              selectedIndex,
              select: selectOptionAndCleanUp,
              highlight: setHighlightedIndex,
            }}
          >
            {children}
          </MentionMenuContext>
        ) : null
      }
    />
  );
}

/** Renders the menu at the caret. */
export function MentionPortal({ children }: { children: ReactNode }) {
  const { anchor } = useMentionMenu();
  return createPortal(
    <Primitives.MentionPopup>{children}</Primitives.MentionPopup>,
    anchor
  );
}

/** The list of matches. `children` renders one row per suggestion. */
export function MentionContent({
  children,
  ...props
}: Omit<ComponentProps<typeof Primitives.MentionList>, 'children'> & {
  children: (suggestion: MentionSuggestion) => ReactNode;
}) {
  const { options } = useMentionMenu();
  return (
    <Primitives.MentionList aria-label="Mention suggestions" {...props}>
      {options.map((option, index) => (
        <MentionItemContext key={option.key} value={{ option, index }}>
          {children(option.suggestion)}
        </MentionItemContext>
      ))}
    </Primitives.MentionList>
  );
}

export function MentionItem(
  props: ComponentProps<typeof Primitives.MentionItem>
) {
  const { selectedIndex, select, highlight } = useMentionMenu();
  const { option, index } = useMentionItem();
  return (
    // Highlight follows Lexical's index alone, so rows sharing a name stay apart.
    <Primitives.MentionItem
      ref={option.setRefElement}
      highlighted={selectedIndex === index}
      onMouseEnter={() => highlight(index)}
      // Keep focus in the editor so the pick lands at the caret.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => select(option)}
      {...props}
    />
  );
}

/** The member's avatar, or a speakerphone for `@channel` and `@here`. */
export function MentionAvatar() {
  const { id, name, image } = useMentionItem().option.suggestion;
  if (BROADCASTS.has(id)) {
    return (
      <Primitives.MentionItemIcon>
        <IconSpeakerphone />
      </Primitives.MentionItemIcon>
    );
  }
  return (
    <UserAvatar
      name={name}
      image={image}
      className="size-6 shrink-0 text-[10px]"
    />
  );
}

export function MentionLabel() {
  const { suggestion } = useMentionItem().option;
  return (
    <Primitives.MentionItemLabel>
      {labelOf(suggestion)}
    </Primitives.MentionItemLabel>
  );
}

export function MentionHint() {
  const { hint } = useMentionItem().option.suggestion;
  return hint ? (
    <Primitives.MentionItemDescription>
      {hint}
    </Primitives.MentionItemDescription>
  ) : null;
}

/** The highlighted row's name and detail in full, so rows can stay one short line each. */
export function MentionFooter() {
  const { options, selectedIndex } = useMentionMenu();
  const suggestion = options[selectedIndex ?? -1]?.suggestion;
  return (
    <Primitives.MentionFooter>
      {suggestion && (
        <>
          <Primitives.MentionFooterTitle>
            {labelOf(suggestion)}
          </Primitives.MentionFooterTitle>
          <Primitives.MentionFooterDescription>
            {suggestion.detail}
          </Primitives.MentionFooterDescription>
        </>
      )}
    </Primitives.MentionFooter>
  );
}
