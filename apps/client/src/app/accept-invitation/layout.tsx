import { Brand } from '@conduit/ui/components/brand';

import { ThemeProvider } from '@/context/theme-provider';

export default function AcceptInvitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider forcedTheme="light">
      <main
        data-surface="light"
        className="bg-background text-foreground flex min-h-svh w-full flex-col font-sans"
      >
        <header className="p-4 sm:p-6">
          <Brand />
        </header>
        <div className="mx-auto w-full max-w-lg px-4 pt-[8vh] pb-16 sm:px-6 sm:pt-[14vh]">
          {children}
        </div>
      </main>
    </ThemeProvider>
  );
}
