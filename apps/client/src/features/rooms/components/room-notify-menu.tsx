'use client';

import {
  effectiveNotify,
  type NotifyLevel,
  type Room,
} from '@conduit/contract';
import {
  IconAt,
  IconBell,
  IconBellOff,
  IconBellRinging,
  IconBellX,
} from '@tabler/icons-react';
import { use } from 'react';

import {
  useMuteRoom,
  useSetRoomNotify,
  useUnmuteRoom,
} from '@/services/rooms/hooks';

import { RoomMenuParts } from './room-menu';

const LEVELS = [
  { value: 'all', label: 'All new messages', icon: IconBellRinging },
  { value: 'mentions', label: 'Mentions only', icon: IconAt },
  { value: 'nothing', label: 'Nothing', icon: IconBellX },
] as const;

/**
 * The viewer's notification rows for a room they belong to, under a Notifications label: a level, with the
 * room's default marked, and Mute. The caller places them inside a `Menu.Group`, which the label needs.
 */
export function RoomNotifyMenu({
  room,
}: {
  room: Pick<Room, 'id' | 'kind' | 'membership'>;
}) {
  const Menu = use(RoomMenuParts);
  const { mutate: setNotify } = useSetRoomNotify();
  const { mutate: mute } = useMuteRoom();
  const { mutate: unmute } = useUnmuteRoom();

  if (!room.membership) return null;

  const defaultLevel = effectiveNotify(room.kind, null);
  const level = effectiveNotify(room.kind, room.membership.notify);
  const muted = !!room.membership.mutedAt;

  return (
    <>
      <Menu.Label>Notifications</Menu.Label>
      <Menu.RadioGroup
        value={level}
        onValueChange={(value) =>
          // The default is stored as no choice, so it keeps following the room's kind.
          setNotify({
            roomId: room.id,
            level: value === defaultLevel ? null : (value as NotifyLevel),
          })
        }
      >
        {LEVELS.map(({ value, label, icon: Icon }) => (
          <Menu.RadioItem key={value} value={value}>
            <Icon data-slot="icon" aria-hidden />
            {label}
            {value === defaultLevel && (
              <span className="text-muted-foreground text-xs">Default</span>
            )}
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
      <Menu.Item onClick={() => (muted ? unmute : mute)({ roomId: room.id })}>
        {muted ? (
          <IconBell data-slot="icon" aria-hidden />
        ) : (
          <IconBellOff data-slot="icon" aria-hidden />
        )}
        {muted ? 'Unmute' : 'Mute'}
      </Menu.Item>
    </>
  );
}

/** The room's current notification setting as an icon and a label, for a button that opens these rows. */
export function RoomNotifyMenuValue({
  room,
}: {
  room: Pick<Room, 'kind' | 'membership'>;
}) {
  if (room.membership?.mutedAt) {
    return (
      <>
        <IconBellOff data-icon="inline-start" aria-hidden />
        Muted
      </>
    );
  }

  const level = effectiveNotify(room.kind, room.membership?.notify ?? null);
  const { label, icon: Icon } =
    LEVELS.find(({ value }) => value === level) ?? LEVELS[0];

  return (
    <>
      <Icon data-icon="inline-start" aria-hidden />
      {label}
    </>
  );
}
