import { DropdownMenuItem } from '@conduit/ui/components/dropdown-menu';
import { ImageIcon } from 'lucide-react';

import { useToolbarContext } from '@/components/editor/context/toolbar-provider';
import { InsertImageDialog } from '@/components/editor/extensions/images-extension';

export function InsertImage() {
  const { activeEditor, showModal } = useToolbarContext();

  return (
    <DropdownMenuItem
      onClick={() => {
        showModal('Insert Image', (onClose) => (
          <InsertImageDialog activeEditor={activeEditor} onClose={onClose} />
        ));
      }}
    >
      <div className="flex items-center gap-1">
        <ImageIcon className="size-4" />
        <span>Image</span>
      </div>
    </DropdownMenuItem>
  );
}
