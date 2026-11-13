import type {
  DndSchedule,
  NotificationSettings,
} from '@/schemas/notifications';
import type { NotifyLevel, RoomKind } from '@/schemas/rooms';

/** What a member gets in a room when they have not chosen: every message in a DM, mentions in a channel. */
export function effectiveNotify(
  kind: RoomKind,
  notify: NotifyLevel | null
): NotifyLevel {
  return notify ?? (kind === 'dm' ? 'all' : 'mentions');
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The weekday (0 is Sunday) and minutes since midnight at `now` in `timeZone`. */
function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? '';

  return {
    day: WEEKDAYS.indexOf(part('weekday')),
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

const toMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

function inSchedule(schedule: DndSchedule, now: Date, timeZone: string) {
  const { day, minutes } = localClock(now, timeZone);
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);

  if (start < end) {
    return schedule.days.includes(day) && minutes >= start && minutes < end;
  }
  // Past midnight: the window belongs to the day it starts on, so the morning half checks yesterday.
  return (
    (schedule.days.includes(day) && minutes >= start) ||
    (schedule.days.includes((day + 6) % 7) && minutes < end)
  );
}

/** Whether Do Not Disturb is on at `now`: a snooze still in the future, or inside the schedule in the member's zone. */
export function isDndActive(
  settings: Pick<NotificationSettings, 'dndUntil' | 'dndSchedule' | 'timeZone'>,
  now: Date
) {
  if (settings.dndUntil && settings.dndUntil > now) return true;
  return (
    !!settings.dndSchedule &&
    inSchedule(settings.dndSchedule, now, settings.timeZone)
  );
}
