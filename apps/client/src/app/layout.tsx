import './globals.css';

import type { Metadata } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { fontVariables } from '@/config/font';
import { cn } from '@/lib/utils';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Conduit',
  description:
    'All-in-one communication platform powered by AI, for modern teams and organizations',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn('h-full antialiased', fontVariables)}
      suppressHydrationWarning
    >
      <body className="h-full">
        <Providers>
          <NuqsAdapter>{children}</NuqsAdapter>
        </Providers>
      </body>
    </html>
  );
}
