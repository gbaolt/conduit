import { DropdownMenuItem } from '@conduit/ui/components/dropdown-menu';
import { INSERT_EMBED_COMMAND } from '@lexical/react/LexicalAutoEmbedPlugin';

import { useToolbarContext } from '@/components/editor/context/toolbar-provider';
import { EmbedConfigs } from '@/components/editor/plugins/embeds/auto-embed-plugin';

export function InsertEmbeds() {
  const { activeEditor } = useToolbarContext();
  return EmbedConfigs.map((embedConfig) => (
    <DropdownMenuItem
      key={embedConfig.type}
      onClick={() => {
        activeEditor.dispatchCommand(INSERT_EMBED_COMMAND, embedConfig.type);
      }}
    >
      <div className="flex items-center gap-1">
        {embedConfig.icon}
        <span>{embedConfig.contentName}</span>
      </div>
    </DropdownMenuItem>
  ));
}
