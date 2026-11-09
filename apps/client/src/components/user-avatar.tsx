import { cn } from '@conduit/ui/lib/utils';
import Image from 'next/image';

export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt="User avatar"
        width={32}
        height={32}
        className={cn('size-8 rounded-full object-cover', className)}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full text-xs font-medium',
        className
      )}
    >
      {initial}
    </span>
  );
}
