import type { Route } from 'next';
import Link from 'next/link';

import { withCallbackURL } from '@/lib/callback-url';
import { cn } from '@/lib/utils';

type AuthActionLinkProps = {
  prompt?: string;
  href: Route;
  label: string;
  callbackURL?: string | null;
  linkClassName?: string;
} & React.ComponentProps<typeof Link>;

export function AuthActionLink({
  prompt = '',
  href,
  label,
  callbackURL,
  className,
  linkClassName,
  ...props
}: AuthActionLinkProps) {
  return (
    <p
      className={cn(
        'text-muted-foreground mt-4 text-center text-xs',
        className
      )}
    >
      {prompt}{' '}
      <Link
        href={withCallbackURL(href, callbackURL) as Route}
        className={cn(
          'text-foreground link-underline font-medium',
          linkClassName
        )}
        {...props}
      >
        {label}
      </Link>
    </p>
  );
}
