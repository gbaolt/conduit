import { Skeleton } from '@conduit/ui/components/skeleton';

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
