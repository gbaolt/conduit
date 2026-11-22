import { DropdownMenuItem } from '@conduit/ui/components/dropdown-menu';
import { TableIcon } from 'lucide-react';

import { useToolbarContext } from '@/components/editor/context/toolbar-provider';
import { InsertTableDialog } from '@/components/editor/plugins/table-plugin';

export function InsertTable() {
  const { activeEditor, showModal } = useToolbarContext();

  return (
    <DropdownMenuItem
      onClick={() =>
        showModal('Insert Table', (onClose) => (
          <InsertTableDialog activeEditor={activeEditor} onClose={onClose} />
        ))
      }
    >
      <TableIcon data-slot="icon" />
      Table
    </DropdownMenuItem>
  );
}
