import { $insertNodeToNearestRoot } from '@lexical/utils';
import { IconChevronRight } from '@tabler/icons-react';
import { $getSelection, $isParagraphNode, $isRangeSelection } from 'lexical';

import {
  $createToggleNode,
  $isToggleTitleNode,
} from '@/components/editor/nodes/toggle-node';
import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

/** Turns the line into a toggle's title, or adds an empty toggle when the line is not a paragraph. */
export function TogglePickerPlugin() {
  return new ComponentPickerOption('Toggle', {
    icon: <IconChevronRight className="size-4" />,
    keywords: ['toggle', 'collapse', 'fold', 'details', 'expand'],
    onSelect: (_, editor) =>
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const block = selection.anchor.getNode().getTopLevelElement();
        const toggle = $createToggleNode();
        const title = toggle.getFirstChild();
        if (!$isToggleTitleNode(title)) return;
        if ($isParagraphNode(block)) {
          title.append(...block.getChildren());
          block.replace(toggle);
        } else {
          $insertNodeToNearestRoot(toggle);
        }
        title.selectEnd();
      }),
  });
}
