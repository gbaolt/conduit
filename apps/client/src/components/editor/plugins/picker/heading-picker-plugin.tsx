import { $createHeadingNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { IconH1, IconH2, IconH3 } from '@tabler/icons-react';
import { $getSelection, $isRangeSelection } from 'lexical';

import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function HeadingPickerPlugin({ n }: { n: 1 | 2 | 3 }) {
  return new ComponentPickerOption(`Heading ${n}`, {
    icon: <HeadingIcons n={n} />,
    keywords: ['heading', 'header', `h${n}`],
    onSelect: (_, editor) =>
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(`h${n}`));
        }
      }),
  });
}

function HeadingIcons({ n }: { n: number }) {
  switch (n) {
    case 1:
      return <IconH1 className="size-4" />;
    case 2:
      return <IconH2 className="size-4" />;
    case 3:
      return <IconH3 className="size-4" />;
  }
}
