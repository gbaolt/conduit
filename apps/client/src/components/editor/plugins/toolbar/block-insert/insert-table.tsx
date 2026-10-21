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
      <div className="flex items-center gap-1">
        <TableIcon className="size-4" />
        <span>Table</span>
      </div>
    </DropdownMenuItem>
  );
}
