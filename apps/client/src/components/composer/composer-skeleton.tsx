import { Button } from '@conduit/ui/components/button';
import {
  IconAt,
  IconBold,
  IconBraces,
  IconCode,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconMoodSmile,
  IconSend2,
  IconStrikethrough,
} from '@tabler/icons-react';

const FORMAT_GROUPS = [
  [IconBold, IconItalic, IconStrikethrough],
  [IconLink],
  [IconList, IconListNumbers],
  [IconCode, IconBraces],
];

export function ComposerSkeleton() {
  return (
    <div
      aria-hidden
      className="border-input bg-pane text-muted-foreground/60 flex flex-col rounded-lg border shadow-[0_1px_3px_rgb(0_0_0/0.08)] [&_svg]:shrink-0"
    >
      <div className="border-border/60 hidden items-center gap-0.5 border-b px-1.5 py-1 sm:flex">
        {FORMAT_GROUPS.map((group, index) => (
          <div key={index} className="flex items-center gap-0.5">
            {index > 0 && <span className="bg-border mx-1 h-4 w-px" />}
            {group.map((Icon, iconIndex) => (
              <Button key={iconIndex} size="icon-xs" variant="ghost" disabled>
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        ))}
      </div>
      <div className="h-11" />
      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
        {[IconMoodSmile, IconAt].map((Icon, index) => (
          <Button key={index} size="icon-sm" variant="ghost" disabled>
            <Icon className="size-5" />
          </Button>
        ))}
        <Button size="icon-sm" className="ml-auto" disabled>
          <IconSend2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
