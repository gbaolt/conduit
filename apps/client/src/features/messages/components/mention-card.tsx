'use client';

import { Button } from '@conduit/ui/components/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@conduit/ui/components/hover-card';
import { IconMessage } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { PresenceDot } from '@/components/presence-dot';
import { UserAvatar } from '@/components/user-avatar';
import { useOpenDm } from '@/services/dms/hooks';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

const ROLE: Record<string, string> = {
  owner: 'Workspace owner',
  admin: 'Workspace admin',
  member: 'Member',
};

function MemberDetails({
  userId,
  isViewer,
}: {
  userId: string;
  isViewer: boolean;
}) {
  const { data: members } = useWorkspaceMembers();
  const member = members?.find((candidate) => candidate.userId === userId);
  const router = useRouter();
  const openDm = useOpenDm();

  if (!member) {
    return (
      <p className="text-muted-foreground text-sm">
        This person is no longer in the workspace.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <UserAvatar
            name={member.name}
            image={member.image}
            className="size-10 rounded-md"
          />
          <PresenceDot
            userId={member.userId}
            className="absolute -right-0.5 -bottom-0.5 size-2.5"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {member.name}
            {isViewer && (
              <span className="text-muted-foreground font-normal"> (you)</span>
            )}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {member.email}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {ROLE[member.role] ?? member.role}
        {member.status === 'deactivated' ? ' · Deactivated' : ''}
      </p>
      {!isViewer && member.status !== 'deactivated' && (
        <Button
          variant="outline"
          size="sm"
          disabled={openDm.isPending}
          onClick={() =>
            openDm.mutate(
              { userIds: [member.userId] },
              {
                onSuccess: (dm) => router.push(`/dms/${dm.id}`),
                onError: (error) => toast.error(error.message),
              }
            )
          }
        >
          <IconMessage />
          Message
        </Button>
      )}
    </div>
  );
}

/** A member's mention. Hovering or focusing it shows who they are and offers a DM. */
export function MentionCard({
  userId,
  isViewer,
  children,
}: {
  userId: string;
  isViewer: boolean;
  children: ReactNode;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        render={
          <span
            className="mention"
            data-self={isViewer || undefined}
            tabIndex={0}
          />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-72">
        <MemberDetails userId={userId} isViewer={isViewer} />
      </HoverCardContent>
    </HoverCard>
  );
}
