import { $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { IconQuote } from '@tabler/icons-react';
import { $getSelection, $isRangeSelection } from 'lexical';

import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function QuotePickerPlugin() {
  return new ComponentPickerOption('Quote', {
    icon: <IconQuote className="size-4" />,
    keywords: ['block quote'],
    onSelect: (_, editor) =>
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      }),
  });
}
