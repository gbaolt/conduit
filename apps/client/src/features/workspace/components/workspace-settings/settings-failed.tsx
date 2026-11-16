'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import { IconCloudOff } from '@tabler/icons-react';

import { SettingsPanel } from './settings-view';

/** Stands in for settings data the API would not send, and offers to ask again. */
export function SettingsFailed({
  title,
  retrying,
  onRetry,
}: {
  title: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <SettingsPanel>
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconCloudOff />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>
            {retrying
              ? 'Trying again…'
              : 'Nothing is lost. Try again in a moment.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </SettingsPanel>
  );
}
