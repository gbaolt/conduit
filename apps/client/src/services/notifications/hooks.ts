'use client';

import { DEFAULT_NOTIFICATION_SETTINGS, isDndActive } from '@conduit/contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getVapidPublicKey } from '@/lib/env';
import { orpc } from '@/lib/orpc';

import { type DesktopState, desktopStateOf } from './desktop';
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

function browserSupportsPush() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    getVapidPublicKey() !== ''
  );
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function subscriptionInput(subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('This browser gave an incomplete push subscription.');
  }
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/**
 * Whether this browser shows desktop notifications, and the two ways to change it. `state` is null until the
 * browser has been read. Permission is only ever asked for inside `enable`, which a click calls.
 */
export function useDesktopNotifications() {
  const [state, setState] = useState<DesktopState | null>(null);
  const [busy, setBusy] = useState(false);
  const { mutateAsync: subscribe } = useMutation(
    orpc.push.subscribe.mutationOptions()
  );
  const { mutateAsync: unsubscribe } = useMutation(
    orpc.push.unsubscribe.mutationOptions()
  );

  const refresh = useCallback(async () => {
    const supported = browserSupportsPush();
    const subscription = supported ? await currentSubscription() : null;
    setState(
      desktopStateOf({
        supported,
        permission: supported ? Notification.permission : 'default',
        subscribed: subscription !== null,
      })
    );
    return subscription;
  }, []);

  useEffect(() => {
    // Saving the subscription again moves a browser that another account used to this one.
    void refresh()
      .then(
        (subscription) =>
          subscription && subscribe(subscriptionInput(subscription))
      )
      .catch(() => {});
  }, [refresh, subscribe]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not change notifications.'
      );
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const enable = () =>
    run(async () => {
      if ((await Notification.requestPermission()) !== 'granted') return;
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: getVapidPublicKey(),
      });
      await subscribe(subscriptionInput(subscription));
    });

  const disable = () =>
    run(async () => {
      const subscription = await currentSubscription();
      if (!subscription) return;
      await unsubscribe({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    });

  return { state, busy, enable, disable };
}
