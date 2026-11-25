import { INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { IconListNumbers } from '@tabler/icons-react';

import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function NumberedListPickerPlugin() {
  return new ComponentPickerOption('Numbered List', {
    icon: <IconListNumbers className="size-4" />,
    keywords: ['numbered list', 'ordered list', 'ol'],
    onSelect: (_, editor) =>
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  });
}
