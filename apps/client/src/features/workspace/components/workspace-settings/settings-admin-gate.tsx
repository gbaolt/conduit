'use client';

import { canWorkspace } from '@conduit/contract';
import { useQuery } from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { sessionQuery } from '@/services/auth/queries';
import { membersQuery } from '@/services/workspaces/queries';

import { SettingsFailed } from './settings-failed';
import { SettingsPageSkeleton } from './settings-skeletons';

/**
 * Shows the workspace areas to admins and owners and sends members home. It reads the member list in the
 * browser, so opening a settings page asks the server for nothing and a failed load keeps the page.
 * Children may read `membersQuery` with suspense: it is in the cache by then. The API enforces the same rule.
 */
export function SettingsAdminGate({ children }: { children: ReactNode }) {
  const members = useQuery(membersQuery);
  const { data: session } = useQuery(sessionQuery);

  if (members.data && session) {
    const viewer = members.data.find(
      (member) => member.userId === session.user.id
    );
    if (!viewer || !canWorkspace('viewSettings', viewer.role)) {
      return redirect('/');
    }
    return children;
  }

  if (!members.data && (members.error ?? members.failureReason)) {
    return (
      <SettingsFailed
        title="Couldn’t open settings"
        retrying={members.isFetching}
        onRetry={() => void members.refetch()}
      />
    );
  }

  return <SettingsPageSkeleton />;
}
