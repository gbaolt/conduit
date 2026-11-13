import { cookies } from 'next/headers';
import { type ReactNode, Suspense } from 'react';

import { SettingsNav } from '@/features/workspace/components/workspace-settings/settings-nav';
import { SettingsPageSkeleton } from '@/features/workspace/components/workspace-settings/settings-skeletons';
import {
  WorkspaceSidebar,
  WorkspaceSidebarMain,
  WorkspaceSidebarPanel,
} from '@/features/workspace/components/workspace-sidebar';
import {
  LAYOUT_COOKIE,
  parseLayout,
} from '@/features/workspace/lib/layout-cookie';
import { requireSession } from '@/services/auth/server';

async function SettingsShell({ children }: { children: ReactNode }) {
  const [, cookieStore] = await Promise.all([requireSession(), cookies()]);

  return (
    <WorkspaceSidebar
      defaultLayout={parseLayout(cookieStore.get(LAYOUT_COOKIE)?.value)}
    >
      <WorkspaceSidebarPanel>
        <SettingsNav />
      </WorkspaceSidebarPanel>
      <WorkspaceSidebarMain>
        <main className="mx-auto max-w-4xl px-4 py-8 md:px-10 md:py-10">
          {children}
        </main>
      </WorkspaceSidebarMain>
    </WorkspaceSidebar>
  );
}

/** The shell every member sees. The workspace areas sit behind `(admin)/layout.tsx`, which sends members home. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <WorkspaceSidebar defaultLayout={undefined}>
          <WorkspaceSidebarPanel>
            <SettingsNav />
          </WorkspaceSidebarPanel>
          <WorkspaceSidebarMain>
            <main className="mx-auto max-w-4xl px-4 py-8 md:px-10 md:py-10">
              <SettingsPageSkeleton />
            </main>
          </WorkspaceSidebarMain>
        </WorkspaceSidebar>
      }
    >
      <SettingsShell>{children}</SettingsShell>
    </Suspense>
  );
}
