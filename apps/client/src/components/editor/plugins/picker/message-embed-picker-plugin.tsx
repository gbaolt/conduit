import { IconMessage } from '@tabler/icons-react';

import { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

/** `/message`, which hands off to the host's message picker. */
export function MessageEmbedPickerPlugin({
  onSelect,
}: {
  onSelect: () => void;
}) {
  return new ComponentPickerOption('Message', {
    icon: <IconMessage className="size-4" />,
    keywords: ['message', 'embed', 'quote message', 'link'],
    onSelect,
  });
}
