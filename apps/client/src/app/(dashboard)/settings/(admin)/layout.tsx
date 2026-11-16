import type { ReactNode } from 'react';

import { SettingsAdminGate } from '@/features/workspace/components/workspace-settings/settings-admin-gate';

/** The workspace areas: only admins and owners get past it. */
export default function AdminSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SettingsAdminGate>{children}</SettingsAdminGate>;
}
