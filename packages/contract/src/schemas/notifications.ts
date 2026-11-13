import { z } from 'zod';

import { isValidTimeZone } from '@/lib/notification-policy';

const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time such as 22:00.');

/** Do Not Disturb on `days` (0 is Sunday). An `end` before `start` runs past midnight, and `days` names the day it starts on. */
export const DndScheduleSchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    start: TimeOfDaySchema,
    end: TimeOfDaySchema,
  })
  .refine(({ start, end }) => start !== end, 'Start and end must differ.');
export type DndSchedule = z.infer<typeof DndScheduleSchema>;

export const TimeZoneSchema = z
  .string()
  .refine(isValidTimeZone, 'Choose a valid time zone.');

export const NotificationSettingsSchema = z.object({
  /** Do Not Disturb is on until this time. */
  dndUntil: z.coerce.date().nullable(),
  dndSchedule: DndScheduleSchema.nullable(),
  /** The IANA zone that the schedule is read in. */
  timeZone: TimeZoneSchema,
  /** Whether the member is emailed a digest of unread mentions. */
  emailDigest: z.boolean(),
});
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

/** Each field is optional, and one left out stays as it is. */
export const UpdateNotificationSettingsInputSchema =
  NotificationSettingsSchema.partial();
export type UpdateNotificationSettingsInput = z.infer<
  typeof UpdateNotificationSettingsInputSchema
>;

/** What a member with no settings row gets. */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dndUntil: null,
  dndSchedule: null,
  timeZone: 'UTC',
  emailDigest: true,
};
