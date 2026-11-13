'use client';

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type DndSchedule,
  isDndActive,
  type NotificationSettings,
  UpdateNotificationSettingsInputSchema,
} from '@conduit/contract';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@conduit/ui/components/field';
import { Input } from '@conduit/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { Switch } from '@conduit/ui/components/switch';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@conduit/ui/components/toggle-group';
import { type SyntheticEvent, useMemo, useState } from 'react';

import { buttonStatus, StatusButton } from '@/components/async/status-button';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/services/notifications/hooks';

import { SettingsPanel, SettingsSection } from '../settings-view';

// Monday first, as a work week reads. The value is the weekday number the schedule stores.
const DAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
];

const DEFAULT_SCHEDULE: DndSchedule = {
  days: [1, 2, 3, 4, 5],
  start: '22:00',
  end: '08:00',
};

type Values = {
  scheduled: boolean;
  schedule: DndSchedule;
  timeZone: string;
  emailDigest: boolean;
};

function initialValues(settings: NotificationSettings): Values {
  return {
    scheduled: !!settings.dndSchedule,
    schedule: settings.dndSchedule ?? DEFAULT_SCHEDULE,
    // Until a schedule is saved, the zone is the browser's, not the server's UTC default.
    timeZone: settings.dndSchedule
      ? settings.timeZone
      : Intl.DateTimeFormat().resolvedOptions().timeZone,
    emailDigest: settings.emailDigest,
  };
}

function SwitchRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <FieldLabel htmlFor={id} className="border-0">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>{title}</FieldTitle>
          <FieldDescription>{description}</FieldDescription>
        </FieldContent>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </Field>
    </FieldLabel>
  );
}

function ScheduleFields({
  values,
  onChange,
}: {
  values: Values;
  onChange: (patch: Partial<Values>) => void;
}) {
  const { schedule, timeZone } = values;
  const zones = useMemo(
    () => [
      ...new Set(['UTC', timeZone, ...Intl.supportedValuesOf('timeZone')]),
    ],
    [timeZone]
  );
  const [now] = useState(() => new Date());
  const active = isDndActive(
    { dndUntil: null, dndSchedule: schedule, timeZone },
    now
  );
  const patchSchedule = (patch: Partial<DndSchedule>) =>
    onChange({ schedule: { ...schedule, ...patch } });

  return (
    <FieldGroup className="gap-5 border-t p-4">
      <Field>
        <FieldLabel id="dnd-days-label">Days</FieldLabel>
        <ToggleGroup
          multiple
          variant="outline"
          spacing={1}
          aria-labelledby="dnd-days-label"
          value={schedule.days.map(String)}
          onValueChange={(days) =>
            patchSchedule({ days: days.map(Number).sort() })
          }
          className="flex-wrap"
        >
          {DAYS.map(({ value, short, long }) => (
            <ToggleGroupItem
              key={value}
              value={String(value)}
              aria-label={long}
              className="aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary"
            >
              {short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <Field>
          <FieldLabel htmlFor="dnd-start">From</FieldLabel>
          <Input
            id="dnd-start"
            type="time"
            required
            value={schedule.start}
            onChange={(event) => patchSchedule({ start: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dnd-end">Until</FieldLabel>
          <Input
            id="dnd-end"
            type="time"
            required
            value={schedule.end}
            onChange={(event) => patchSchedule({ end: event.target.value })}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="dnd-time-zone">Time zone</FieldLabel>
        <Select
          value={timeZone}
          onValueChange={(value) => value && onChange({ timeZone: value })}
        >
          <SelectTrigger id="dnd-time-zone" className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {zones.map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          Read from this browser. Change it if you are working elsewhere.
        </FieldDescription>
      </Field>

      <p className="text-sm" role="status">
        <span className="font-medium">
          {active ? 'On right now.' : 'Off right now.'}
        </span>{' '}
        <span className="text-muted-foreground">
          {schedule.start} to {schedule.end} in {timeZone}
          {schedule.end < schedule.start ? ', ending the next morning' : ''}.
        </span>
      </p>
    </FieldGroup>
  );
}

function Form({ settings }: { settings: NotificationSettings }) {
  const update = useUpdateNotificationSettings();
  const [values, setValues] = useState(() => initialValues(settings));
  const patch = (next: Partial<Values>) =>
    setValues((current) => ({ ...current, ...next }));

  const parsed = UpdateNotificationSettingsInputSchema.safeParse({
    dndSchedule: values.scheduled ? values.schedule : null,
    timeZone: values.timeZone,
    emailDigest: values.emailDigest,
  });

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (parsed.success) update.mutate(parsed.data);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <SettingsSection
        id="dnd-heading"
        title="Do Not Disturb"
        description="Quiet hours that repeat every week. To pause once, use your avatar menu."
      >
        <SettingsPanel>
          <div className="p-4">
            <SwitchRow
              id="dnd-scheduled"
              title="Pause on a schedule"
              description="Push and email wait until the schedule ends."
              checked={values.scheduled}
              onCheckedChange={(scheduled) => patch({ scheduled })}
            />
          </div>
          {values.scheduled ? (
            <ScheduleFields values={values} onChange={patch} />
          ) : null}
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection
        id="email-heading"
        title="Email"
        description="What Conduit sends to your inbox."
      >
        <SettingsPanel className="p-4">
          <SwitchRow
            id="email-digest"
            title="Email me about unread mentions"
            description="One email while you are away, listing mentions you have not read."
            checked={values.emailDigest}
            onCheckedChange={(emailDigest) => patch({ emailDigest })}
          />
        </SettingsPanel>
      </SettingsSection>

      {!parsed.success && (
        <p role="alert" className="text-destructive text-sm">
          {parsed.error.issues[0]?.message}
        </p>
      )}
      <StatusButton
        type="submit"
        className="self-end"
        disabled={!parsed.success}
        status={buttonStatus(update)}
        successLabel="Saved"
      >
        Save changes
      </StatusButton>
    </form>
  );
}

export function NotificationsForm() {
  const { data, isPending } = useNotificationSettings();

  if (isPending) {
    return (
      <div role="status" aria-label="Loading notification settings">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  // A failed load falls back to the defaults, and saving then writes the first row.
  return <Form settings={data ?? DEFAULT_NOTIFICATION_SETTINGS} />;
}
