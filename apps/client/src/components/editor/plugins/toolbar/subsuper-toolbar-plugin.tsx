import {
  ToggleGroup,
  ToggleGroupItem,
} from '@conduit/ui/components/toggle-group';
import { $isTableSelection } from '@lexical/table';
import {
  $isRangeSelection,
  type BaseSelection,
  FORMAT_TEXT_COMMAND,
} from 'lexical';
import { SubscriptIcon, SuperscriptIcon } from 'lucide-react';
import { useState } from 'react';

import { useToolbarContext } from '@/components/editor/context/toolbar-provider';
import { useUpdateToolbarHandler } from '@/components/editor/editor-hooks/use-update-toolbar';

export function SubSuperToolbarPlugin() {
  const { activeEditor } = useToolbarContext();
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);

  const $updateToolbar = (selection: BaseSelection) => {
    if ($isRangeSelection(selection) || $isTableSelection(selection)) {
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));
    }
  };

  useUpdateToolbarHandler($updateToolbar);

  return (
    <ToggleGroup
      defaultValue={
        isSubscript ? ['subscript'] : isSuperscript ? ['superscript'] : []
      }
    >
      <ToggleGroupItem
        value="subscript"
        size="sm"
        aria-label="Toggle subscript"
        onClick={() => {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript');
        }}
        variant="default"
      >
        <SubscriptIcon className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="superscript"
        size="sm"
        aria-label="Toggle superscript"
        onClick={() => {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript');
        }}
        variant="default"
      >
        <SuperscriptIcon className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
