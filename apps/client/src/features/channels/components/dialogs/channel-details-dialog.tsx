'use client';

import {
  canChannel,
  CHANNEL_TEXT_MAX,
  type Room,
  type RoomMember,
  UpdateChannelInputSchema,
} from '@conduit/contract';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { Input } from '@conduit/ui/components/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@conduit/ui/components/tabs';
import { Textarea } from '@conduit/ui/components/textarea';
import { IconDots, IconHash, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { UserAvatar } from '@/components/nav-user';
import { PresenceDot } from '@/components/presence-dot';
import { sessionQuery } from '@/services/auth/queries';
import {
  useLeaveChannel,
  useRemoveChannelMember,
  useSetChannelMemberRole,
  useUpdateChannel,
} from '@/services/channels/hooks';
import { roomMembersQuery, roomQuery } from '@/services/rooms/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { copy } from '../../lib/channel-actions';
import { useExitOpenChannel } from '../../lib/use-exit-open-channel';

type TextField = 'topic' | 'description';

function EditableText({
  channel,
  field,
  label,
  canEdit,
}: {
  channel: Room;
  field: TextField;
  label: string;
  canEdit: boolean;
}) {
  const updateChannel = useUpdateChannel();
  const [draft, setDraft] = useState<string | null>(null);
  const value = channel[field];
  const error =
    draft === null
      ? undefined
      : UpdateChannelInputSchema.shape[field].safeParse(draft).error?.issues[0]
          ?.message;
  const Field = field === 'topic' ? Input : Textarea;

  const save = (event: FormEvent) => {
    event.preventDefault();
    updateChannel.mutate(
      { roomId: channel.id, [field]: draft },
      {
        onSuccess: () => setDraft(null),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-muted-foreground text-xs font-medium">{label}</h3>
      {draft === null ? (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm wrap-break-word whitespace-pre-wrap">
            {value ?? <span className="text-muted-foreground">Not set</span>}
          </p>
          {canEdit && (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Edit ${label.toLowerCase()}`}
              onClick={() => setDraft(value ?? '')}
            >
              Edit
            </Button>
          )}
        </div>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={save}>
          <Field
            autoFocus
            aria-label={label}
            aria-invalid={!!error}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            {error ? (
              <span role="alert" className="text-destructive text-xs">
                {error}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs tabular-nums">
                {CHANNEL_TEXT_MAX - draft.trim().length}
              </span>
            )}
            <span className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setDraft(null)}
              >
                Cancel
              </Button>
              <StatusButton
                type="submit"
                size="xs"
                disabled={!!error}
                status={updateChannel.isPending ? 'loading' : 'idle'}
              >
                Save
              </StatusButton>
            </span>
          </div>
        </form>
      )}
    </section>
  );
}

function AboutTab({
  channel,
  members,
}: {
  channel: Room;
  members: RoomMember[];
}) {
  const { open, close } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();
  const exitOpenChannel = useExitOpenChannel();
  const leaveChannel = useLeaveChannel();
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;
  const canEdit = canChannel('editDetails', workspaceRole, channel);
  const creator = members.find(
    (member) => member.userId === channel.createdById
  );
  const created = channel.createdAt.toLocaleDateString(undefined, {
    dateStyle: 'medium',
  });

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1">
        <h3 className="text-muted-foreground text-xs font-medium">Name</h3>
        <div className="flex items-center gap-2">
          <Glyph className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 truncate text-sm">{channel.name}</p>
          {canChannel('rename', workspaceRole, channel) && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => open({ kind: 'rename', channel })}
            >
              Rename
            </Button>
          )}
        </div>
      </section>
      <EditableText
        channel={channel}
        field="topic"
        label="Topic"
        canEdit={canEdit}
      />
      <EditableText
        channel={channel}
        field="description"
        label="Description"
        canEdit={canEdit}
      />
      <p className="text-muted-foreground text-xs">
        {creator
          ? `Created by ${creator.name} on ${created}`
          : `Created ${created}`}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy(`${location.origin}/channels/${channel.id}`)}
        >
          Copy link
        </Button>
        {canChannel('leave', workspaceRole, channel) && (
          <StatusButton
            variant="destructive"
            size="sm"
            status={leaveChannel.isPending ? 'loading' : 'idle'}
            onClick={() =>
              leaveChannel.mutate(
                { roomId: channel.id },
                {
                  onSuccess: () => {
                    close();
                    exitOpenChannel(channel.id);
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            Leave channel
          </StatusButton>
        )}
      </div>
    </div>
  );
}

function MemberRow({
  channel,
  member,
  viewerId,
}: {
  channel: Room;
  member: RoomMember;
  viewerId: string | undefined;
}) {
  const workspaceRole = useWorkspaceRole();
  const setRole = useSetChannelMemberRole();
  const removeMember = useRemoveChannelMember();
  const isManager = member.role === 'manager';
  const canSetRole = canChannel('setManager', workspaceRole, channel);
  const canRemove =
    canChannel('removeMember', workspaceRole, channel) &&
    member.userId !== viewerId;
  const target = { roomId: channel.id, userId: member.userId };

  // mutateAsync, not mutate: the menu closes on click, and per-call callbacks die with it.
  const onError = (error: Error) => toast.error(error.message);

  return (
    <li className="flex items-center gap-2 py-1.5">
      <span className="relative">
        <UserAvatar name={member.name} image={member.image} />
        <PresenceDot
          userId={member.userId}
          className="absolute right-0 bottom-0"
        />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        {member.name}
      </p>
      {isManager && <Badge variant="secondary">Manager</Badge>}
      {(canSetRole || canRemove) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${member.name}`}
              />
            }
          >
            <IconDots />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canSetRole && (
              <DropdownMenuItem
                onClick={() =>
                  setRole
                    .mutateAsync({
                      ...target,
                      role: isManager ? 'member' : 'manager',
                    })
                    .catch(onError)
                }
              >
                {isManager ? 'Remove manager' : 'Make manager'}
              </DropdownMenuItem>
            )}
            {canSetRole && canRemove && <DropdownMenuSeparator />}
            {canRemove && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => removeMember.mutateAsync(target).catch(onError)}
              >
                Remove from channel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function MembersTab({
  channel,
  members,
  isPending,
}: {
  channel: Room;
  members: RoomMember[];
  isPending: boolean;
}) {
  const { open } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();
  const { data: session } = useQuery(sessionQuery);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {channel.memberCount}{' '}
          {channel.memberCount === 1 ? 'member' : 'members'}
        </p>
        {canChannel('addMembers', workspaceRole, channel) && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => open({ kind: 'add-members', channel })}
          >
            Add people
          </Button>
        )}
      </div>
      {isPending ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Loading members…
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              channel={channel}
              member={member}
              viewerId={session?.user.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChannelDetailsDialog({
  channel: opened,
  tab = 'about',
}: {
  channel: Room;
  tab?: 'about' | 'members';
}) {
  const { close } = useChannelDialogs();
  // The dialog outlives edits, so it reads the live channel instead of the snapshot it opened with.
  const { data: channel = opened } = useQuery(roomQuery(opened.id));
  const { data: members = [], isPending } = useQuery(
    roomMembersQuery(opened.id)
  );

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">#{channel.name}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={tab}>
          <TabsList>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
          <TabsContent value="about" className="pt-2">
            <AboutTab channel={channel} members={members} />
          </TabsContent>
          <TabsContent value="members" className="pt-2">
            <MembersTab
              channel={channel}
              members={members}
              isPending={isPending}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
