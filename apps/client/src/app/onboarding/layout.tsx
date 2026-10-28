import { Brand } from '@conduit/ui/components/brand';

import { ThemeProvider } from '@/context/theme-provider';
import { SignOutButton } from '@/features/auth/components/sign-out-button';

export default function OnboardingLayout({
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
        <header className="flex items-center justify-between p-4 sm:p-6">
          <Brand />
          <SignOutButton />
        </header>
        <div className="mx-auto w-full max-w-lg px-4 pt-[8vh] pb-16 sm:px-6 sm:pt-[14vh]">
          {children}
        </div>
      </main>
    </ThemeProvider>
  );
}
