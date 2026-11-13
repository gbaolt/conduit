'use client';

import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';

import { useDesktopNotifications } from '@/services/notifications/hooks';

import { SettingsPanel, SettingsSection } from '../settings-view';

const STATUS = {
  on: { label: 'On', variant: 'default' },
  off: { label: 'Off', variant: 'secondary' },
  blocked: { label: 'Blocked', variant: 'outline' },
  unsupported: { label: 'Not available', variant: 'outline' },
} as const;

const DETAIL = {
  on: 'This browser shows a notification for a mention, a thread reply, or a direct message while Conduit is closed.',
  off: 'Get a notification on this computer when something needs you and Conduit is closed. Your browser asks first.',
  blocked:
    'Your browser is blocking notifications from Conduit. Open the site settings from the lock icon beside the address, set Notifications to Allow, and reload this page.',
  unsupported:
    'This browser cannot show desktop notifications. On a Mac, Safari needs Conduit added to the Dock first.',
} as const;

/** Unlike the rest of the form, this acts on this browser at once, so it has no Save. */
export function DesktopNotifications() {
  const { state, busy, enable, disable } = useDesktopNotifications();
  const status = state ? STATUS[state] : null;

  return (
    <SettingsSection
      id="desktop-heading"
      title="Desktop"
      description="Push notifications on this browser. Each browser you use turns them on for itself."
    >
      <SettingsPanel className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Desktop notifications</h3>
            {status ? (
              <Badge variant={status.variant} role="status">
                {status.label}
              </Badge>
            ) : (
              <Skeleton className="h-5 w-10 rounded-4xl" />
            )}
          </div>
          <p className="text-muted-foreground text-sm text-pretty">
            {state ? DETAIL[state] : null}
          </p>
        </div>

        {state === 'off' || state === 'blocked' ? (
          <Button
            type="button"
            className="shrink-0"
            disabled={busy || state === 'blocked'}
            onClick={enable}
          >
            Turn on desktop notifications
          </Button>
        ) : null}
        {state === 'on' ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={busy}
            onClick={disable}
          >
            Turn off desktop notifications
          </Button>
        ) : null}
      </SettingsPanel>
    </SettingsSection>
  );
}
