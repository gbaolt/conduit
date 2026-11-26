import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/extension';
import { IconMinus } from '@tabler/icons-react';

import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function DividerPickerPlugin() {
  return new ComponentPickerOption('Divider', {
    icon: <IconMinus className="size-4" />,
    keywords: ['horizontal rule', 'divider', 'hr'],
    onSelect: (_, editor) =>
      editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
  });
}
