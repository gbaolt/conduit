import { $setBlocksType } from '@lexical/selection';
import { IconInfoSquareRounded } from '@tabler/icons-react';
import { $getSelection, $isRangeSelection } from 'lexical';

import { $createCalloutNode } from '@/components/editor/nodes/callout-node';
import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function CalloutPickerPlugin() {
  return new ComponentPickerOption('Callout', {
    icon: <IconInfoSquareRounded className="size-4" />,
    keywords: ['callout', 'note', 'tip', 'warning', 'info'],
    onSelect: (_, editor) =>
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCalloutNode());
        }
      }),
  });
}
