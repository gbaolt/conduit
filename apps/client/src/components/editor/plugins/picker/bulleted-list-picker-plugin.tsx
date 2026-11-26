import { INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { IconList } from '@tabler/icons-react';

import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function BulletedListPickerPlugin() {
  return new ComponentPickerOption('Bulleted List', {
    icon: <IconList className="size-4" />,
    keywords: ['bulleted list', 'unordered list', 'ul'],
    onSelect: (_, editor) =>
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
  });
}
