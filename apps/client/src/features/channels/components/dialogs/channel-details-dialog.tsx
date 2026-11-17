'use client';

import { canChannel, type Room, type RoomMember } from '@conduit/contract';
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
import { Tabs, TabsContent } from '@conduit/ui/components/tabs';
import { IconDots, IconHash, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
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
} from '@/services/channels/hooks';
import { roomMembersQuery, roomQuery } from '@/services/rooms/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { useExitOpenChannel } from '../../hooks/use-exit-open-channel';
import { ChannelTextForm, type TextField } from '../forms/channel-text-form';
import {
  PERMISSIONS,
  PostingPermissionsForm,
} from '../forms/posting-permissions-form';
import { RenameChannelForm } from '../forms/rename-channel-form';

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
  const [editing, setEditing] = useState(false);
  const value = channel[field];

  return (
    <RoomDetailsRow
      title={label}
      action={
        canEdit &&
        !editing && (
          <RoomDetailsEdit label={label} onClick={() => setEditing(true)} />
        )
      }
    >
      {editing ? (
        <ChannelTextForm
          channel={channel}
          field={field}
          label={label}
          onDone={() => setEditing(false)}
        />
      ) : (
        <p className="min-w-0 text-sm wrap-break-word whitespace-pre-wrap">
          {value ?? (
            <span className="text-muted-foreground">
              {canEdit ? `Add a ${label.toLowerCase()}` : 'Not set'}
            </span>
          )}
        </p>
      )}
    </RoomDetailsRow>
  );
}

function AboutTab({
  channel,
  members,
  renaming,
}: {
  channel: Room;
  members: RoomMember[];
  renaming?: boolean;
}) {
  const workspaceRole = useWorkspaceRole();
  const canEdit = canChannel('editDetails', workspaceRole, channel);
  const creator = members.find(
    (member) => member.userId === channel.createdById
  );
  const created = format(channel.createdAt, 'MMMM d, yyyy');

  return (
    <div className="flex flex-col gap-3">
      <ChannelNameCard channel={channel} renaming={renaming} />
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

function ChannelNameCard({
  channel,
  renaming = false,
}: {
  channel: Room;
  renaming?: boolean;
}) {
  const [editing, setEditing] = useState(renaming);
  const workspaceRole = useWorkspaceRole();
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  return (
    <RoomDetailsCard>
      <RoomDetailsRow
        title="Channel name"
        action={
          canChannel('rename', workspaceRole, channel) &&
          !editing && (
            <RoomDetailsEdit
              label="Channel name"
              onClick={() => setEditing(true)}
            />
          )
        }
      >
        {editing ? (
          <RenameChannelForm
            channel={channel}
            onDone={() => setEditing(false)}
          />
        ) : (
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <Glyph className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate">{channel.name}</span>
          </p>
        )}
      </RoomDetailsRow>
    </RoomDetailsCard>
  );
}

/** Who may post, reply and notify everyone. A manager or admin edits all three in place. */
function PostingPermissionsCard({ channel }: { channel: Room }) {
  const workspaceRole = useWorkspaceRole();
  const [editing, setEditing] = useState(false);
  const canEdit = canChannel('setPermissions', workspaceRole, channel);

  return (
    <RoomDetailsCard>
      <RoomDetailsRow
        title="Posting permissions"
        action={
          canEdit &&
          !editing && (
            <RoomDetailsEdit
              label="Posting permissions"
              onClick={() => setEditing(true)}
            />
          )
        }
      >
        {editing ? (
          <PostingPermissionsForm
            channel={channel}
            onDone={() => setEditing(false)}
          />
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {PERMISSIONS.map(({ key, says }) => (
              <li key={key}>{says[channel.permissions[key]]}</li>
            ))}
          </ul>
        )}
      </RoomDetailsRow>
    </RoomDetailsCard>
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
    <div className="flex flex-col gap-3">
      <ChannelNameCard channel={channel} />
      <PostingPermissionsCard channel={channel} />
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
  renaming,
}: {
  channel: Room;
  tab?: 'about' | 'members' | 'settings';
  renaming?: boolean;
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
          <RoomDetailsBody className="min-h-[30svh]">
            <TabsContent value="about">
              <AboutTab
                channel={channel}
                members={members}
                renaming={renaming}
              />
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
