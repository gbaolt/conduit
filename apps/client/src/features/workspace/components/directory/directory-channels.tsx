'use client';

import { canChannel, type Room } from '@conduit/contract';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowsSort,
  IconCheck,
  IconHash,
  IconLock,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { useDeferredValue } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { FilterSearch } from '@/components/filter/filter-search';
import { FilterSelect } from '@/components/filter/filter-select';
import { useChannelDialogs } from '@/features/channels/context/channel-dialogs-provider';
import { useCanCreateChannel } from '@/features/channels/hooks/use-can-create-channel';
import { useJoinChannel } from '@/services/channels/hooks';
import {
  archivedChannelsQuery,
  channelsQuery,
} from '@/services/channels/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import {
  CHANNEL_MEMBERSHIPS,
  CHANNEL_SORTS,
  CHANNEL_TYPES,
  channelParams,
  findChannels,
} from '../../lib/directory';
import {
  DirectoryCount,
  DirectoryEmpty,
  DirectoryList,
  DirectoryListSkeleton,
  DirectoryResults,
  DirectoryToolbar,
  DirectoryToolbarEnd,
} from './directory';

/** The header action. Only people who may create a channel of some kind see it. */
export function DirectoryCreateChannelButton() {
  const { open } = useChannelDialogs();
  const canPublic = useCanCreateChannel('public');
  const canPrivate = useCanCreateChannel('private');

  return (
    (canPublic || canPrivate) && (
      <Button size="sm" onClick={() => open({ kind: 'create' })}>
        <IconPlus data-icon="inline-start" />
        Create channel
      </Button>
    )
  );
}

const DirectoryChannelDot = () => (
  <span aria-hidden className="text-muted-foreground/60">
    ·
  </span>
);

/**
 * A channel's row. A channel the viewer can open is a link across the whole row; one they can join shows
 * Join at the end.
 */
function DirectoryChannel({ channel }: { channel: Room }) {
  const router = useRouter();
  const role = useWorkspaceRole();
  const joinChannel = useJoinChannel();
  const href = `/channels/${channel.id}` as const;
  const joined = channel.membership !== null;
  const opens = joined || channel.archivedAt !== null;
  const Glyph = channel.visibility === 'private' ? IconLock : IconHash;

  return (
    <li className="hover:bg-muted/50 has-[a:focus-visible]:ring-ring relative flex items-center gap-4 px-4 py-3.5 transition-colors has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 font-semibold">
          <Glyph className="text-muted-foreground size-4 shrink-0" />
          {opens ? (
            <Link
              href={href}
              className="truncate outline-none after:absolute after:inset-0"
            >
              {channel.name}
            </Link>
          ) : (
            <span className="truncate">{channel.name}</span>
          )}
          {channel.archivedAt && (
            <Badge variant="outline" className="shrink-0">
              Archived
            </Badge>
          )}
        </p>
        <p className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-xs">
          {joined && (
            <>
              <span className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                <IconCheck className="size-3.5" />
                Joined
              </span>
              <DirectoryChannelDot />
            </>
          )}
          <span className="shrink-0 tabular-nums">
            {channel.memberCount}{' '}
            {channel.memberCount === 1 ? 'member' : 'members'}
          </span>
          {channel.description && (
            <>
              <DirectoryChannelDot />
              <span className="truncate">{channel.description}</span>
            </>
          )}
        </p>
      </div>
      {!opens && canChannel('join', role, channel) && (
        <StatusButton
          variant="outline"
          size="sm"
          status={joinChannel.isPending ? 'loading' : 'idle'}
          aria-label={`Join ${channel.name}`}
          onClick={() =>
            joinChannel.mutate(
              { roomId: channel.id },
              {
                onSuccess: () => router.push(href),
                onError: (error) => toast.error(error.message),
              }
            )
          }
        >
          Join
        </StatusButton>
      )}
    </li>
  );
}

/** Every channel the viewer can see, as rows, with a search, membership and type filters, and a sort. */
export function DirectoryChannels() {
  const [params, setParams] = useQueryStates(channelParams);
  const query = useDeferredValue(params);
  const archived = params.show === 'archived';
  const { data, isPending, isError, refetch } = useQuery(
    archived ? archivedChannelsQuery : channelsQuery
  );
  const channels = findChannels(data ?? [], query);
  const filtered = params.q !== '' || params.type !== 'any';

  let results;
  if (isPending) results = <DirectoryListSkeleton label="Loading channels" />;
  else if (isError) {
    results = (
      <DirectoryEmpty
        icon={IconAlertTriangle}
        title="Couldn't load channels"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  } else if (channels.length === 0) {
    if (filtered) {
      results = (
        <DirectoryEmpty
          icon={IconSearch}
          title="No channels match"
          description="Try another name, or clear the filters."
          action={{
            label: 'Clear filters',
            onClick: () => void setParams({ q: null, type: null }),
          }}
        />
      );
    } else if (archived) {
      results = (
        <DirectoryEmpty
          icon={IconArchive}
          title="No archived channels"
          description="Channels show up here once they are archived."
        />
      );
    } else {
      results = (
        <DirectoryEmpty
          icon={IconHash}
          title="No channels here"
          description={
            params.show === 'joined'
              ? "You haven't joined a channel yet."
              : "You're in every channel you can see."
          }
          action={{
            label: 'Show all channels',
            onClick: () => void setParams({ show: null }),
          }}
        />
      );
    }
  } else {
    results = (
      <DirectoryList label="Channels">
        {channels.map((channel) => (
          <DirectoryChannel key={channel.id} channel={channel} />
        ))}
      </DirectoryList>
    );
  }

  return (
    <>
      <DirectoryToolbar>
        <FilterSearch
          label="Search channels"
          placeholder="Search by name or description"
          className="w-full sm:w-72"
        />
        <FilterSelect
          name="show"
          parser={channelParams.show}
          options={CHANNEL_MEMBERSHIPS}
          label="Show"
        />
        <FilterSelect
          name="type"
          parser={channelParams.type}
          options={CHANNEL_TYPES}
          label="Channel type"
        />
        <DirectoryToolbarEnd>
          <DirectoryCount
            count={channels.length}
            one="channel"
            many="channels"
          />
          <FilterSelect
            name="sort"
            parser={channelParams.sort}
            options={CHANNEL_SORTS}
            label="Sort channels"
            icon={IconArrowsSort}
            align="end"
          />
        </DirectoryToolbarEnd>
      </DirectoryToolbar>
      <DirectoryResults>{results}</DirectoryResults>
    </>
  );
}
