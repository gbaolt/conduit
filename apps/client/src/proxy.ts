import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const protectedRoutes = ['/', '/onboarding'];
const authRoutes = [
  '/sign-in',
  '/sign-up',
  '/reset-password',
  '/forgot-password',
  '/verify-email',
];

function matchesPath(pathname: string, routes: readonly string[]) {
  return routes.some((route) => {
    if (route === '/') {
      return pathname === '/';
    }

    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function isSafeInternalPath(value: string | null): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
  );
}

export function proxy(request: NextRequest) {
  const session = getSessionCookie(request);
  const pathname = request.nextUrl.pathname;

  if (matchesPath(pathname, protectedRoutes) && !session) {
    const url = new URL('/sign-in', request.url);
    url.searchParams.set('callbackURL', pathname);
    return NextResponse.redirect(url);
  }

  if (matchesPath(pathname, authRoutes) && session) {
    const callbackURL = request.nextUrl.searchParams.get('callbackURL');
    const redirectUrl = isSafeInternalPath(callbackURL) ? callbackURL : '/';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
