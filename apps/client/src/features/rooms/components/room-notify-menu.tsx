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

/** The viewer's Notifications submenu for a room they belong to: a level, with the room's default marked, and Mute. */
export function RoomNotifyMenu({ room }: { room: Room }) {
  const Menu = use(RoomMenuParts);
  const { mutate: setNotify } = useSetRoomNotify();
  const { mutate: mute } = useMuteRoom();
  const { mutate: unmute } = useUnmuteRoom();

  if (!room.membership) return null;

  const defaultLevel = effectiveNotify(room.kind, null);
  const level = effectiveNotify(room.kind, room.membership.notify);
  const muted = !!room.membership.mutedAt;

  return (
    <Menu.Sub>
      <Menu.SubTrigger>
        <IconBell data-slot="icon" aria-hidden />
        Notifications
      </Menu.SubTrigger>
      <Menu.SubContent className="w-60">
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
        <Menu.Separator />
        <Menu.Item onClick={() => (muted ? unmute : mute)({ roomId: room.id })}>
          {muted ? (
            <IconBell data-slot="icon" aria-hidden />
          ) : (
            <IconBellOff data-slot="icon" aria-hidden />
          )}
          {muted ? 'Unmute' : 'Mute'}
        </Menu.Item>
      </Menu.SubContent>
    </Menu.Sub>
  );
}
