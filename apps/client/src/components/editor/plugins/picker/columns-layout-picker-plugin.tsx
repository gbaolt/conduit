import { IconColumns3 } from '@tabler/icons-react';

import { InsertLayoutDialog } from '@/components/editor/plugins/layout-plugin';
import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

export function ColumnsLayoutPickerPlugin() {
  return new ComponentPickerOption('Columns Layout', {
    icon: <IconColumns3 className="size-4" />,
    keywords: ['columns', 'layout', 'grid'],
    onSelect: (_, editor, showModal) =>
      showModal('Insert Columns Layout', (onClose) => (
        <InsertLayoutDialog activeEditor={editor} onClose={onClose} />
      )),
  });
}
