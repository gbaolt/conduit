'use client';

import { canWorkspace, type WorkspaceInvitation } from '@conduit/contract';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import {
  IconAlertTriangle,
  IconArrowsSort,
  IconLock,
  IconMail,
  IconMailForward,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useDeferredValue } from 'react';
import { toast } from 'sonner';

import { FilterSearch } from '@/components/filter/filter-search';
import { FilterSelect } from '@/components/filter/filter-select';
import {
  useRevokeInvitation,
  useWorkspaceRole,
} from '@/services/workspaces/hooks';
import { workspaceInvitationsQuery } from '@/services/workspaces/queries';

import {
  findInvitations,
  INVITATION_ROLES,
  INVITATION_SORTS,
  invitationParams,
} from '../lib/directory';
import {
  DirectoryCount,
  DirectoryEmpty,
  DirectoryList,
  DirectoryListSkeleton,
  DirectoryResults,
  DirectoryToolbar,
  DirectoryToolbarEnd,
} from './directory';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** A pending invitation: who, as what, from whom, until when, and a way to take it back. */
function DirectoryInvitation({
  invitation,
}: {
  invitation: WorkspaceInvitation;
}) {
  const revoke = useRevokeInvitation();
  const expired = invitation.expiresAt.getTime() < Date.now();

  return (
    <li className="bg-background hover:bg-muted dark:bg-input/30 dark:hover:bg-input/50 outline-shadow border-border flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors">
      <IconMail className="text-muted-foreground size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 font-semibold">
          <span className="truncate">{invitation.email}</span>
          <Badge variant="secondary" className="shrink-0 capitalize">
            {invitation.role}
          </Badge>
        </p>
        <p className="text-muted-foreground mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs">
          <span className="truncate">Invited by {invitation.inviterName}</span>
          <span aria-hidden className="text-muted-foreground/60">
            ·
          </span>
          {expired ? (
            <span className="text-destructive font-medium">
              Expired {dateFormat.format(invitation.expiresAt)}
            </span>
          ) : (
            <span className="tabular-nums">
              Expires {dateFormat.format(invitation.expiresAt)}
            </span>
          )}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={revoke.isPending}
        aria-label={`Revoke invitation for ${invitation.email}`}
        onClick={() =>
          revoke.mutate(
            { invitationId: invitation.id },
            {
              onSuccess: () =>
                toast.success(`Revoked the invitation for ${invitation.email}`),
              onError: (error) => toast.error(error.message),
            }
          )
        }
      >
        Revoke
      </Button>
    </li>
  );
}

/** The workspace's pending invitations, with a search, a role filter and a sort. Only people who may invite see them. */
export function DirectoryInvitations() {
  const canInvite = canWorkspace('invite', useWorkspaceRole());
  const [params, setParams] = useQueryStates(invitationParams);
  const query = useDeferredValue(params);
  const { data, isPending, isError, refetch } = useQuery({
    ...workspaceInvitationsQuery,
    enabled: canInvite,
  });
  const invitations = findInvitations(data ?? [], query);
  const filtered = params.q !== '' || params.role !== 'any';

  if (!canInvite) {
    return (
      <DirectoryResults>
        <DirectoryEmpty
          icon={IconLock}
          title="Only admins see invitations"
          description="Ask a workspace admin to invite someone."
        />
      </DirectoryResults>
    );
  }

  let results;

  if (isPending) {
    results = <DirectoryListSkeleton label="Loading invitations" />;
  } else if (isError) {
    results = (
      <DirectoryEmpty
        icon={IconAlertTriangle}
        title="Couldn't load invitations"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  } else if (invitations.length === 0) {
    results = filtered ? (
      <DirectoryEmpty
        icon={IconSearch}
        title="No invitations match"
        description="Try another email, or clear the filters."
        action={{
          label: 'Clear filters',
          onClick: () => void setParams({ q: null, role: null }),
        }}
      />
    ) : (
      <DirectoryEmpty
        icon={IconMailForward}
        title="No pending invitations"
        description="Invitations you send stay here until they are accepted or expire."
      />
    );
  } else {
    results = (
      <DirectoryList label="Invitations">
        {invitations.map((invitation) => (
          <DirectoryInvitation key={invitation.id} invitation={invitation} />
        ))}
      </DirectoryList>
    );
  }

  return (
    <>
      <DirectoryToolbar>
        <FilterSearch
          label="Search invitations"
          placeholder="Search by email or inviter"
          className="w-full sm:w-72"
        />
        <FilterSelect
          name="role"
          parser={invitationParams.role}
          options={INVITATION_ROLES}
          label="Role"
        />
        <DirectoryToolbarEnd>
          <DirectoryCount
            count={invitations.length}
            one="invitation"
            many="invitations"
          />
          <FilterSelect
            name="sort"
            parser={invitationParams.sort}
            options={INVITATION_SORTS}
            label="Sort invitations"
            icon={IconArrowsSort}
            align="end"
          />
        </DirectoryToolbarEnd>
      </DirectoryToolbar>
      <DirectoryResults>{results}</DirectoryResults>
    </>
  );
}
