'use client';

import { buttonVariants } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import { IconArrowLeft } from '@tabler/icons-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * A phone has room for the workspace sidebar or the page, not both. The sidebar gets its own route: the
 * channel list at `/`, the settings menu at `/settings`. Every other route shows its page.
 */
export const listHref = (pathname: string): Route =>
  pathname.startsWith('/settings') ? '/settings' : '/';

export const useAtList = () => {
  const pathname = usePathname();
  return pathname === listHref(pathname);
};

/** The page header's way back to the list. Only a phone shows it, since wider screens keep the list beside the page. */
export function ListBackLink() {
  const href = listHref(usePathname());

  return (
    <Link
      href={href}
      aria-label={href === '/' ? 'Back to channels' : 'Back to settings'}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
        '-ms-2 shrink-0 md:hidden pointer-coarse:size-11'
      )}
    >
      <IconArrowLeft />
    </Link>
  );
}

/** Replaces a list route with `href` from tablet width up, where the list has no screen of its own. */
export function ListDesktopRedirect({ href }: { href: Route }) {
  const router = useRouter();

  useEffect(() => {
    const wide = matchMedia('(min-width: 48rem)');
    const go = () => {
      if (wide.matches) router.replace(href);
    };
    go();
    wide.addEventListener('change', go);
    return () => wide.removeEventListener('change', go);
  }, [href, router]);

  return null;
}
