'use client';

import { Brand } from '@conduit/ui/components/brand';
import { Button } from '@conduit/ui/components/button';
import { IconMenu2, IconX } from '@tabler/icons-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Route } from 'next';
import Link from 'next/link';
import React from 'react';

import { useHeaderTheme } from '@/hooks/use-header-theme';
import { getSignInUrl } from '@/lib/env';
import { easeDrawer } from '@/lib/motion';
import { cn } from '@/lib/utils';

const menuItems: { name: string; href: Route }[] = [
  { name: 'Product', href: '#product' as Route },
  { name: 'Solutions', href: '#solutions' as Route },
  { name: 'Company', href: '#company' as Route },
  { name: 'Pricing', href: '#pricing' as Route },
];

export default function SiteHeader() {
  const [menuState, setMenuState] = React.useState(false);
  const reduced = useReducedMotion() ?? false;
  const headerTheme = useHeaderTheme('light');

  React.useEffect(() => {
    if (!menuState) return;

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const updateOverflow = () => {
      document.documentElement.classList.toggle(
        'overflow-hidden',
        mediaQuery.matches
      );
    };

    updateOverflow();
    mediaQuery.addEventListener('change', updateOverflow);

    return () => {
      mediaQuery.removeEventListener('change', updateOverflow);
      document.documentElement.classList.remove('overflow-hidden');
    };
  }, [menuState]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-100 flex flex-row items-center justify-center px-4 pt-2">
      <nav
        data-state={menuState ? 'active' : undefined}
        data-surface={headerTheme}
        data-theme={headerTheme}
        className={cn(
          'pointer-events-auto relative w-full max-w-6xl',
          'rounded-xl border backdrop-blur-xl',
          'transition-[background-color,border-color,color,box-shadow] duration-500',
          'ease-out-cubic',
          'max-lg:data-[state=active]:rounded-xl',
          headerTheme === 'dark' && 'dark',
          'bg-background/70 border-border shadow-sm'
        )}
      >
        <div className="relative flex flex-wrap items-center justify-between gap-3 p-2">
          <div className="flex w-full items-center justify-between md:w-auto">
            <Link href="/" aria-label="home" className="flex items-center pl-1">
              <Brand className="origin-left scale-90" />
            </Link>

            <Button
              type="button"
              variant="ghost"
              data-slot="menu-trigger"
              onClick={() => setMenuState(!menuState)}
              aria-label={menuState ? 'Close Menu' : 'Open Menu'}
              className="group relative z-20 md:hidden"
            >
              <IconMenu2
                className={cn(
                  'text-foreground ease-out-cubic size-5 transition-all duration-300',
                  menuState && 'scale-0 rotate-90 opacity-0'
                )}
              />
              <IconX
                className={cn(
                  'text-foreground ease-out-cubic absolute size-5 transition-all duration-300',
                  menuState
                    ? 'scale-100 rotate-0 opacity-100'
                    : 'scale-0 -rotate-90 opacity-0'
                )}
              />
            </Button>
          </div>

          <div className="absolute inset-0 m-auto hidden size-fit md:block">
            <ul className="flex items-center gap-1 text-sm">
              {menuItems.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/60 block rounded-lg px-3 py-1.5 duration-200"
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(item.href.slice(1));
                      el?.scrollIntoView({ behavior: 'smooth' });
                      window.history.pushState(null, '', item.href);
                    }}
                  >
                    <span>{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Button
              size="sm"
              nativeButton={false}
              render={<a href={getSignInUrl()}>Get Started</a>}
            />
          </div>

          <AnimatePresence>
            {menuState && (
              <motion.div
                key="mobile-menu"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{
                  duration: reduced ? 0.15 : 0.28,
                  ease: easeDrawer,
                }}
                className="w-full space-y-6 px-2 pb-3 md:hidden"
              >
                <ul>
                  {menuItems.map((item, index) => (
                    <motion.li
                      key={item.name}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      transition={{
                        duration: reduced ? 0.15 : 0.24,
                        delay: reduced ? 0 : 0.04 * index,
                        ease: easeDrawer,
                      }}
                    >
                      <Link
                        href={item.href}
                        className="text-foreground block py-2.5 text-lg font-medium"
                        onClick={() => setMenuState(false)}
                      >
                        <span>{item.name}</span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
                <div className="flex w-full flex-col gap-2 sm:flex-row">
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<a href={getSignInUrl()}>Get Started</a>}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  );
}
