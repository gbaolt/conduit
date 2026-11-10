import { Skeleton } from '@conduit/ui/components/skeleton';
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

// Fixed widths: a random width would differ between the server and the client render.
const ROWS = [
  { name: 'w-28', bodies: ['w-3/5'] },
  { name: 'w-24', bodies: ['w-4/5', 'w-2/5'] },
  { name: 'w-32', bodies: ['w-1/2'] },
  { name: 'w-20', bodies: ['w-2/3', 'w-1/3'] },
];

/** Stands in for the log: an avatar square, a name bar, and one or two body bars per row, at the real pitch. */
export function ConversationSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading messages"
      className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden px-5 py-3"
    >
      {ROWS.map((row, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className={`h-3.5 ${row.name}`} />
            {row.bodies.map((width, bodyIndex) => (
              <Skeleton key={bodyIndex} className={`h-3.5 ${width}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const FORMAT_GROUPS = [
  [IconBold, IconItalic, IconStrikethrough],
  [IconLink],
  [IconList, IconListNumbers],
  [IconCode, IconBraces],
];

/** The composer's frame, bars, and icons with nothing wired up, so the page keeps its shape while it loads. */
export function ConversationComposerSkeleton() {
  return (
    <div
      aria-hidden
      className="border-input bg-surface text-muted-foreground/60 flex flex-col rounded-lg border shadow-[0_1px_3px_rgb(0_0_0/0.08)] [&_svg]:shrink-0"
    >
      <div className="border-border/60 hidden items-center gap-0.5 border-b px-1.5 py-1 sm:flex">
        {FORMAT_GROUPS.map((group, index) => (
          <div key={index} className="flex items-center gap-0.5">
            {index > 0 && <span className="bg-border mx-1 h-4 w-px" />}
            {group.map((Icon, iconIndex) => (
              <span
                key={iconIndex}
                className="flex size-7 items-center justify-center"
              >
                <Icon className="size-4" />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="h-11" />
      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
        {[IconMoodSmile, IconAt].map((Icon, index) => (
          <span key={index} className="flex size-8 items-center justify-center">
            <Icon className="size-5" />
          </span>
        ))}
        <span className="bg-secondary ml-auto flex size-8 items-center justify-center rounded-md">
          <IconSend2 className="size-4" />
        </span>
      </div>
    </div>
  );
}
