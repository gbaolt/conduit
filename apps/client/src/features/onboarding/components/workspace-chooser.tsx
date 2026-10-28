'use client';

import { Button } from '@conduit/ui/components/button';
import { Spinner } from '@conduit/ui/components/spinner';
import { IconChevronRight, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  useAcceptInvitation,
  useSwitchWorkspace,
} from '@/services/workspaces/hooks';
import {
  invitationsQuery,
  workspacesQuery,
} from '@/services/workspaces/queries';

const rowClass =
  'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none';
const buttonRowClass = cn(
  rowClass,
  'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none'
);

// A stable hue per workspace, so the same workspace always wears the same tint.
function hueOf(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function WorkspaceMark({
  id,
  name,
  logo,
}: {
  id: string;
  name: string;
  logo?: string | null;
}) {
  if (logo) {
    return (
      <Image
        src={logo}
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-lg object-cover"
      />
    );
  }

  const hue = hueOf(id);

  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
      style={{
        backgroundColor: `oklch(0.94 0.04 ${hue})`,
        color: `oklch(0.42 0.1 ${hue})`,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function RowText({ title, detail }: { title: ReactNode; detail: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{title}</span>
      <span className="text-muted-foreground block truncate text-[13px]">
        {detail}
      </span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-1.5">
      <h2 className="text-muted-foreground px-4 pt-2 pb-1 text-[13px] font-medium">
        {title}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-destructive px-4 pb-3 text-sm">
      {children}
    </p>
  );
}

export function WorkspaceChooser({ onCreate }: { onCreate: () => void }) {
  const router = useRouter();
  const goHome = () => router.push('/');
  const workspaces = useQuery(workspacesQuery);
  const invitations = useQuery(invitationsQuery);
  const accept = useAcceptInvitation();
  const open = useSwitchWorkspace();
  const leaving =
    accept.isPending || accept.isSuccess || open.isPending || open.isSuccess;

  return (
    <div className="flex flex-col gap-4">
      <div className="divide-border border-border divide-y rounded-xl border">
        {!!invitations.data?.length && (
          <Section title="Invitations">
            {invitations.data.map((invitation) => (
              <li key={invitation.id} className={rowClass}>
                <WorkspaceMark
                  id={invitation.organizationId}
                  name={invitation.organizationName}
                />
                <RowText
                  title={invitation.organizationName}
                  detail={`Invited as ${invitation.role}, expires ${formatDistanceToNow(invitation.expiresAt, { addSuffix: true })}`}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={leaving}
                  onClick={() =>
                    accept.mutate(
                      { invitationId: invitation.id },
                      { onSuccess: goHome }
                    )
                  }
                >
                  {accept.isPending &&
                  accept.variables.invitationId === invitation.id ? (
                    <Spinner />
                  ) : null}
                  Accept
                </Button>
              </li>
            ))}
            {accept.isError && <ErrorLine>{accept.error.message}</ErrorLine>}
          </Section>
        )}

        {!!workspaces.data?.length && (
          <Section title="Your workspaces">
            {workspaces.data.map((workspace) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() =>
                    open.mutate(workspace.id, { onSuccess: goHome })
                  }
                  className={buttonRowClass}
                >
                  <WorkspaceMark {...workspace} />
                  <RowText title={workspace.name} detail={workspace.slug} />
                  {open.isPending && open.variables === workspace.id ? (
                    <Spinner />
                  ) : (
                    <IconChevronRight className="text-muted-foreground size-4" />
                  )}
                </button>
              </li>
            ))}
            {open.isError && <ErrorLine>{open.error.message}</ErrorLine>}
          </Section>
        )}

        <div className="py-1.5">
          <button
            type="button"
            disabled={leaving}
            onClick={onCreate}
            className={buttonRowClass}
          >
            <span className="border-border text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed">
              <IconPlus className="size-4" />
            </span>
            <RowText
              title="Create a workspace"
              detail="Start a new one and invite your team."
            />
            <IconChevronRight className="text-muted-foreground size-4" />
          </button>
        </div>
      </div>

      {invitations.isError ? (
        <p className="text-muted-foreground text-[13px]">
          Couldn&apos;t load your invitations.{' '}
          <button
            type="button"
            onClick={() => void invitations.refetch()}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </p>
      ) : invitations.data?.length === 0 ? (
        <p className="text-muted-foreground text-[13px] text-pretty">
          Waiting for an invitation? Ask a workspace admin to send one to this
          email.
        </p>
      ) : null}
    </div>
  );
}
