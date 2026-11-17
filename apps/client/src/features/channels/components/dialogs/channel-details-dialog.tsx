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
import { Dialog, DialogTitle } from '@conduit/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { Input } from '@conduit/ui/components/input';
import { Tabs, TabsContent } from '@conduit/ui/components/tabs';
import { Textarea } from '@conduit/ui/components/textarea';
import { IconDots, IconHash, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { PresenceDot } from '@/components/presence-dot';
import { UserAvatar } from '@/components/user-avatar';
import {
  RoomDetailsActions,
  RoomDetailsBody,
  RoomDetailsCard,
  RoomDetailsContent,
  RoomDetailsEdit,
  RoomDetailsHeader,
  RoomDetailsId,
  RoomDetailsRow,
  RoomDetailsTab,
  RoomDetailsTabList,
} from '@/features/rooms/components/room-details';
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
import { useExitOpenChannel } from '../../hooks/use-exit-open-channel';

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
    <RoomDetailsRow
      title={label}
      action={
        canEdit &&
        draft === null && (
          <RoomDetailsEdit
            label={label}
            onClick={() => setDraft(value ?? '')}
          />
        )
      }
    >
      {draft === null ? (
        <p className="min-w-0 text-sm wrap-break-word whitespace-pre-wrap">
          {value ?? (
            <span className="text-muted-foreground">
              {canEdit ? `Add a ${label.toLowerCase()}` : 'Not set'}
            </span>
          )}
        </p>
      ) : (
        <form className="flex flex-col gap-2 pt-1" onSubmit={save}>
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
    </RoomDetailsRow>
  );
}

function AboutTab({
  channel,
  members,
}: {
  channel: Room;
  members: RoomMember[];
}) {
  const { open } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;
  const canEdit = canChannel('editDetails', workspaceRole, channel);
  const creator = members.find(
    (member) => member.userId === channel.createdById
  );
  const created = format(channel.createdAt, 'MMMM d, yyyy');

  return (
    <div className="flex flex-col gap-3">
      <RoomDetailsCard>
        <RoomDetailsRow
          title="Channel name"
          action={
            canChannel('rename', workspaceRole, channel) && (
              <RoomDetailsEdit
                label="Channel name"
                onClick={() => open({ kind: 'rename', channel })}
              />
            )
          }
        >
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <Glyph className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate">{channel.name}</span>
          </p>
        </RoomDetailsRow>
      </RoomDetailsCard>
      <RoomDetailsCard>
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
        <RoomDetailsRow title="Created by">
          <p className="text-sm">
            {creator ? `${creator.name} on ${created}` : created}
          </p>
        </RoomDetailsRow>
      </RoomDetailsCard>
      <RoomDetailsId label="Channel ID" id={channel.id} />
    </div>
  );
}

/** What the viewer may change about the channel as a whole: who can find it, whether it is open, and leaving. */
function SettingsTab({ channel }: { channel: Room }) {
  const { open, close } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();
  const exitOpenChannel = useExitOpenChannel();
  const leaveChannel = useLeaveChannel();
  const isPrivate = channel.visibility === 'private';
  const archived = channel.archivedAt !== null;
  const canVisibility = canChannel(
    isPrivate ? 'makePublic' : 'makePrivate',
    workspaceRole,
    channel
  );
  const canArchive = canChannel(
    archived ? 'unarchive' : 'archive',
    workspaceRole,
    channel
  );

  return (
    <RoomDetailsCard>
      <RoomDetailsRow
        title="Visibility"
        action={
          canVisibility && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => open({ kind: 'visibility', channel })}
            >
              {isPrivate ? 'Change to public' : 'Change to private'}
            </Button>
          )
        }
      >
        <p className="text-muted-foreground text-sm">
          {isPrivate
            ? 'Private. Only people who are added can find and read it.'
            : 'Public. Anyone in the workspace can find and join it.'}
        </p>
      </RoomDetailsRow>
      {canArchive && (
        <RoomDetailsRow
          title={archived ? 'Unarchive channel' : 'Archive channel'}
          action={
            <Button
              variant="outline"
              size="xs"
              onClick={() => open({ kind: 'archive', channel })}
            >
              {archived ? 'Unarchive' : 'Archive'}
            </Button>
          }
        >
          <p className="text-muted-foreground text-sm">
            {archived
              ? 'People can post in it again.'
              : 'Nobody can post in it. Everyone in it can still read it.'}
          </p>
        </RoomDetailsRow>
      )}
      {canChannel('leave', workspaceRole, channel) && (
        <RoomDetailsRow
          title="Leave channel"
          action={
            <StatusButton
              variant="destructive"
              size="xs"
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
              Leave
            </StatusButton>
          }
        >
          <p className="text-muted-foreground text-sm">
            {isPrivate
              ? 'Someone in it has to add you again to come back.'
              : 'You can join again from the channel directory.'}
          </p>
        </RoomDetailsRow>
      )}
    </RoomDetailsCard>
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
  tab?: 'about' | 'members' | 'settings';
}) {
  const { close } = useChannelDialogs();
  // The dialog outlives edits, so it reads the live channel instead of the snapshot it opened with.
  const { data: channel = opened } = useQuery(roomQuery(opened.id));
  const { data: members = [], isPending } = useQuery(
    roomMembersQuery(opened.id)
  );
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <RoomDetailsContent>
        <RoomDetailsHeader>
          <DialogTitle className="flex min-w-0 items-center gap-1 pr-8 text-xl font-semibold">
            <Glyph className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{channel.name}</span>
          </DialogTitle>
          <RoomDetailsActions room={channel} />
        </RoomDetailsHeader>
        <Tabs defaultValue={tab} className="min-h-0 gap-0">
          <RoomDetailsTabList>
            <RoomDetailsTab value="about">About</RoomDetailsTab>
            <RoomDetailsTab value="members" count={channel.memberCount}>
              Members
            </RoomDetailsTab>
            <RoomDetailsTab value="settings">Settings</RoomDetailsTab>
          </RoomDetailsTabList>
          <RoomDetailsBody>
            <TabsContent value="about">
              <AboutTab channel={channel} members={members} />
            </TabsContent>
            <TabsContent value="members">
              <MembersTab
                channel={channel}
                members={members}
                isPending={isPending}
              />
            </TabsContent>
            <TabsContent value="settings">
              <SettingsTab channel={channel} />
            </TabsContent>
          </RoomDetailsBody>
        </Tabs>
      </RoomDetailsContent>
    </Dialog>
  );
}
