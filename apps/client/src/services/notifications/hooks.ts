'use client';

import { DEFAULT_NOTIFICATION_SETTINGS, isDndActive } from '@conduit/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc';

import { notificationSettingsQuery } from './queries';

export function useNotificationSettings() {
  return useQuery(notificationSettingsQuery);
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.notificationSettings.update.mutationOptions({
      onSuccess: (settings) =>
        queryClient.setQueryData(notificationSettingsQuery.queryKey, settings),
      onError: (error) => toast.error(error.message),
    })
  );
}

const CLOCK_TICK_MS = 30_000;

/** The clock, so a snooze or schedule that ends turns the moon off without a reload. */
function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return now;
}

function formatUntil(until: Date, now: Date) {
  const sameDay = until.toDateString() === now.toDateString();
  return until.toLocaleString([], {
    weekday: sameDay ? undefined : 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Whether Do Not Disturb is on, and the text that says when it ends. */
export function useDnd() {
  const { data: settings = DEFAULT_NOTIFICATION_SETTINGS } =
    useNotificationSettings();
  const now = useNow();
  const until =
    settings.dndUntil && settings.dndUntil > now ? settings.dndUntil : null;

  if (until) {
    return {
      active: true,
      snoozed: true,
      label: `Paused until ${formatUntil(until, now)}`,
    };
  }
  const active = isDndActive(settings, now);
  return {
    active,
    snoozed: false,
    label: active ? `Paused until ${settings.dndSchedule?.end}` : null,
  };
}
