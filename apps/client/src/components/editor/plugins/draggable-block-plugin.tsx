import { Button } from '@conduit/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@conduit/ui/components/command';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { DraggableBlockPlugin_EXPERIMENTAL } from '@lexical/react/LexicalDraggableBlockPlugin';
import { IconGripVertical, IconPlus } from '@tabler/icons-react';
import {
  $createParagraphNode,
  $createTextNode,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $isParagraphNode,
  $isTextNode,
  type NodeKey,
} from 'lexical';
import {
  type JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as ReactDOM from 'react-dom';

import { useEditorModal } from '@/components/editor/editor-hooks/use-modal';
import type { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';
import { matchesPickerQuery } from '@/components/editor/utils/picker-query';

const DRAGGABLE_BLOCK_MENU_CLASSNAME = 'draggable-block-menu';

type PickerState = {
  insertBefore: boolean;
  targetNodeKey: NodeKey;
};

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest(`.${DRAGGABLE_BLOCK_MENU_CLASSNAME}`);
}

export function DraggableBlockPlugin({
  anchorElem,
  baseOptions = [],
  dynamicOptionsFn,
}: {
  anchorElem: HTMLElement | null;
  baseOptions?: Array<ComponentPickerOption>;
  dynamicOptionsFn?: ({
    queryString,
  }: {
    queryString: string;
  }) => Array<ComponentPickerOption>;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [modal, showModal] = useEditorModal();
  const menuRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);
  const [draggableElement, setDraggableElement] = useState<HTMLElement | null>(
    null
  );
  const [pickerState, setPickerState] = useState<PickerState | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [queryString, setQueryString] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [pickerPosition, setPickerPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const options = useMemo(() => {
    if (!queryString) {
      return baseOptions;
    }
    return [
      ...(dynamicOptionsFn?.({ queryString }) ?? []),
      ...baseOptions.filter((option) =>
        matchesPickerQuery(option, queryString)
      ),
    ];
  }, [baseOptions, dynamicOptionsFn, queryString]);

  useEffect(() => {
    if (!isPickerOpen) return;
    setHighlightedIndex((current) =>
      Math.min(current, Math.max(options.length - 1, 0))
    );
  }, [isPickerOpen, options.length]);

  useEffect(() => {
    if (!isPickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        (pickerRef.current && pickerRef.current.contains(target)) ||
        (menuRef.current && menuRef.current.contains(target))
      ) {
        return;
      }
      setIsPickerOpen(false);
      setPickerState(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen]);

  const selectOption = useCallback(
    (option: ComponentPickerOption) => {
      if (!pickerState) {
        setIsPickerOpen(false);
        return;
      }
      setIsPickerOpen(false);
      editor.update(() => {
        const node = $getNodeByKey(pickerState.targetNodeKey);
        if (!node) return;
        const placeholder = $createParagraphNode();
        const textNode = $createTextNode('');
        placeholder.append(textNode);
        if (pickerState.insertBefore) {
          node.insertBefore(placeholder);
        } else {
          node.insertAfter(placeholder);
        }
        textNode.select();
        option.onSelect(queryString, editor, showModal);
        const latestPlaceholder = placeholder.getLatest();
        if ($isParagraphNode(latestPlaceholder)) {
          const onlyChild = latestPlaceholder.getFirstChild();
          if (
            $isTextNode(onlyChild) &&
            onlyChild.getTextContent().length === 0 &&
            latestPlaceholder.getChildrenSize() === 1
          ) {
            latestPlaceholder.remove();
          }
        }
      });
    },
    [editor, pickerState, queryString, showModal]
  );

  useEffect(() => {
    if (!isPickerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!options.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((i) => (i + 1 >= options.length ? 0 : i + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((i) => (i - 1 < 0 ? options.length - 1 : i - 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const option = options[highlightedIndex];
        if (option) selectOption(option);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setIsPickerOpen(false);
        setPickerState(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlightedIndex, isPickerOpen, options, selectOption]);

  function openComponentPicker(e: React.MouseEvent) {
    if (!draggableElement || !editor) return;

    let targetNodeKey: NodeKey | null = null;
    editor.read(() => {
      const resolvedNode = $getNearestNodeFromDOMNode(draggableElement);
      if (resolvedNode) {
        targetNodeKey = resolvedNode.getKey();
      }
    });

    if (!targetNodeKey) return;

    const insertBefore = e.altKey || e.ctrlKey;
    const rect = menuRef.current?.getBoundingClientRect();
    setPickerPosition(
      rect
        ? {
            left: rect.left + rect.width + window.scrollX + 8,
            top: rect.top + window.scrollY,
          }
        : null
    );
    setPickerState({ insertBefore, targetNodeKey });
    setQueryString('');
    setHighlightedIndex(0);
    setIsPickerOpen(true);
  }

  if (!anchorElem) return null;

  return (
    <>
      {modal}
      {isPickerOpen &&
        pickerPosition &&
        ReactDOM.createPortal(
          <div
            ref={pickerRef}
            className="absolute z-50 w-56 rounded-md shadow-md"
            style={{
              left: pickerPosition.left,
              top: pickerPosition.top,
            }}
          >
            <Command>
              <CommandInput
                placeholder="Filter blocks..."
                value={queryString}
                onValueChange={setQueryString}
              />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {options.map((option, i) => (
                    <CommandItem
                      key={option.key}
                      value={option.title}
                      onSelect={() => {
                        setHighlightedIndex(i);
                        selectOption(option);
                      }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`flex items-center gap-2 ${
                        highlightedIndex === i ? 'bg-accent' : '!bg-transparent'
                      }`}
                    >
                      {option.icon}
                      {option.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>,
          document.body
        )}
      <DraggableBlockPlugin_EXPERIMENTAL
        anchorElem={anchorElem}
        menuRef={menuRef as React.RefObject<HTMLDivElement>}
        targetLineRef={targetLineRef as React.RefObject<HTMLDivElement>}
        menuComponent={
          // Lexical places the menu 4px inside the editable. Pulled left by the editable's pl-8, its two buttons
          // end just before the text instead of covering the first letters.
          <div
            ref={menuRef}
            className="draggable-block-menu absolute top-0 -left-8 flex items-center opacity-0 will-change-transform"
          >
            <Button
              variant="ghost"
              size="icon-xs"
              title="Click to add below (Alt/Ctrl: add above)"
              className="text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer rounded-sm"
              onClick={openComponentPicker}
            >
              <IconPlus />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:bg-accent hover:text-foreground cursor-grab rounded-sm active:cursor-grabbing"
              tabIndex={-1}
            >
              <IconGripVertical className="opacity-60" />
            </Button>
          </div>
        }
        targetLineComponent={
          <div
            ref={targetLineRef}
            className="bg-primary pointer-events-none absolute top-0 left-0 h-0.5 opacity-0 will-change-transform"
          />
        }
        isOnMenu={isOnMenu}
        onElementChanged={setDraggableElement}
      />
    </>
  );
}
