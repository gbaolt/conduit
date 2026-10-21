import { Brand } from '@conduit/ui/components/brand';
import { Button } from '@conduit/ui/components/button';
import { Toaster } from '@conduit/ui/components/sonner';
import { IconChevronLeft } from '@tabler/icons-react';
import Image from 'next/image';
import { Suspense } from 'react';

import { ThemeProvider } from '@/context/theme-provider';
import { getMarketingBaseUrl } from '@/lib/env';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider forcedTheme="light">
      <main
        data-surface="light"
        className="bg-background text-foreground flex min-h-screen w-full flex-col font-sans lg:flex-row"
      >
        <div
          className="sticky flex min-h-[40vh] w-full flex-col justify-between overflow-hidden p-8 md:p-12 lg:min-h-screen lg:w-1/2 lg:p-16"
          style={{ viewTransitionName: 'auth-hero' }}
        >
          <div className="pointer-events-none absolute inset-0 lg:inset-8">
            <Image
              src="https://assets.giabao.dev/auth.avif"
              alt="Abstract blue background"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover lg:rounded-2xl"
              priority
            />
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <Brand textClassName="text-white" />

            <Button
              variant="ghost"
              nativeButton={false}
              className="text-background! gap-1.5 hover:bg-blue-500/20! has-data-[icon=inline-start]:ps-1.5"
              render={<a href={getMarketingBaseUrl()} />}
            >
              <IconChevronLeft data-icon="inline-start" />
              Back to Website
            </Button>
          </div>

          <div className="relative z-10 mt-12 lg:mt-0">
            <h1 className="text-background mb-4 max-w-xl text-4xl leading-[1.1] font-medium tracking-tight sm:text-5xl lg:text-6xl">
              Where Innovation
              <br />
              Meets Impact.
            </h1>
            <blockquote className="text-muted max-w-lg text-base leading-relaxed text-balance sm:text-lg">
              Conduit empowers teams to build, scale, and transform with
              technology that drives real results.
            </blockquote>
          </div>
        </div>

        <Suspense>{children}</Suspense>
      </main>

      <Toaster richColors closeButton theme="light" />
    </ThemeProvider>
  );
}
