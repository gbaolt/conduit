import { INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { IconListCheck } from '@tabler/icons-react';

import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function CheckListPickerPlugin() {
  return new ComponentPickerOption('Check List', {
    icon: <IconListCheck className="size-4" />,
    keywords: ['check list', 'todo list'],
    onSelect: (_, editor) =>
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
  });
}
