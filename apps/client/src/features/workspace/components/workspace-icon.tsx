import { BrandIcon } from '@conduit/ui/components/brand';
import Image from 'next/image';

import { cn } from '@/lib/utils';

/** The workspace's uploaded icon, or the brand icon when it has none. */
export function WorkspaceIcon({
  logo,
  size,
  className,
}: {
  logo?: string | null;
  size: number;
  className?: string;
}) {
  return logo ? (
    <Image
      src={logo}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 rounded-lg object-cover', className)}
    />
  ) : (
    <BrandIcon className={cn('shrink-0 rounded-lg', className)} />
  );
}
