import { Spinner } from '@conduit/ui/components/spinner';

export function ConversationLoading() {
  return (
    <div
      role="status"
      className="animate-in fade-in-0 fill-mode-backwards text-muted-foreground flex min-h-0 flex-1 items-center justify-center delay-300 duration-200 ease-out motion-reduce:delay-0"
    >
      <Spinner className="size-6" />
      <span className="sr-only">Loading messages</span>
    </div>
  );
}
