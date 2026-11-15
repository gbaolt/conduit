const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * When a DM last had a message, as short as the DM list can show it: minutes within the hour, the time
 * today, then the weekday within the week, then the date.
 */
export function dmTime(date: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE_MS);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes} min`;

  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return timeFormat.format(date);
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekdayFormat.format(date);
  if (date.getFullYear() === now.getFullYear()) return dayFormat.format(date);
  return fullFormat.format(date);
}
