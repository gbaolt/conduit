import { $setBlocksType } from '@lexical/selection';
import { IconTextSize } from '@tabler/icons-react';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
} from 'lexical';

import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function ParagraphPickerPlugin() {
  return new ComponentPickerOption('Paragraph', {
    icon: <IconTextSize className="size-4" />,
    keywords: ['normal', 'paragraph', 'p', 'text'],
    onSelect: (_, editor) =>
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      }),
  });
}
