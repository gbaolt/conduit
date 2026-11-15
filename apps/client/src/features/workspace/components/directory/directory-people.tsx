'use client';

import { canWorkspace, type WorkspaceMember } from '@conduit/contract';
import { Badge } from '@conduit/ui/components/badge';
import { Button } from '@conduit/ui/components/button';
import { Card } from '@conduit/ui/components/card';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconAlertTriangle,
  IconArrowsSort,
  IconSearch,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { useDeferredValue } from 'react';
import { toast } from 'sonner';

import { FilterSearch } from '@/components/filter/filter-search';
import { FilterSelect } from '@/components/filter/filter-select';
import { PresenceDot } from '@/components/presence-dot';
import { sessionQuery } from '@/services/auth/queries';
import { useOpenDm } from '@/services/dms/hooks';
import { useWorkspaceRole } from '@/services/workspaces/hooks';
import { membersQuery } from '@/services/workspaces/queries';

import {
  findPeople,
  PEOPLE_ACCOUNTS,
  PEOPLE_ROLES,
  PEOPLE_SORTS,
  peopleParams,
} from '../../lib/directory';
import { InvitePeopleButton } from '../workspace-settings/invite-people-button';
import {
  DirectoryCount,
  DirectoryEmpty,
  DirectoryResults,
  DirectoryToolbar,
  DirectoryToolbarEnd,
} from './directory';

const grid =
  'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:gap-4';

/** Flat tints for people without a photo. A name always gets the same one. */
const TINTS = [
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  'bg-orange-500/15 text-orange-700 dark:text-orange-300',
];

const tintOf = (name: string) =>
  TINTS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TINTS.length];

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || '?';

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin' } as const;

/** The header action. Only people who may invite see it. */
export function DirectoryInviteButton() {
  return canWorkspace('invite', useWorkspaceRole()) && <InvitePeopleButton />;
}

function DirectoryPersonPhoto({ member }: { member: WorkspaceMember }) {
  if (member.image) {
    return (
      <Image
        src={member.image}
        alt=""
        fill
        sizes="(min-width: 640px) 14rem, 50vw"
        className="object-cover transition-transform duration-300 ease-out group-hover/person:scale-[1.03] motion-reduce:transition-none"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex size-full items-center justify-center text-5xl font-semibold tracking-tight',
        tintOf(member.name)
      )}
    >
      {initialsOf(member.name)}
    </span>
  );
}

/** A member's card. Choosing it opens a DM with them, or the self DM on the viewer's own card. */
function DirectoryPerson({
  member,
  isSelf,
}: {
  member: WorkspaceMember;
  isSelf: boolean;
}) {
  const router = useRouter();
  const openDm = useOpenDm();
  const active = member.status === 'active';
  const role = member.role === 'member' ? null : ROLE_LABEL[member.role];

  return (
    <li className="group/person">
      <Card
        className={cn(
          'hover:ring-foreground/25 has-[[data-slot=button]:focus-visible]:ring-ring relative h-full gap-0 py-0 transition-[box-shadow,opacity] has-[[data-slot=button]:focus-visible]:ring-2',
          !active && 'opacity-60',
          openDm.isPending && 'opacity-70'
        )}
      >
        <div
          className={cn(
            'bg-muted relative aspect-square overflow-hidden',
            !active && 'grayscale'
          )}
        >
          <DirectoryPersonPhoto member={member} />
        </div>
        <div className="flex min-w-0 flex-col gap-1 p-3">
          <p className="flex min-w-0 items-center gap-1.5 font-semibold">
            <span className="truncate">{member.name}</span>
            {isSelf && (
              <span className="text-muted-foreground shrink-0 font-normal">
                (you)
              </span>
            )}
            {active && (
              <PresenceDot userId={member.userId} className="shrink-0" />
            )}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {member.email}
          </p>
          {(role || !active) && (
            <div className="mt-1 flex gap-1">
              {role && <Badge variant="secondary">{role}</Badge>}
              {!active && <Badge variant="outline">Deactivated</Badge>}
            </div>
          )}
        </div>
        {active && (
          <Button
            variant="ghost"
            aria-label={isSelf ? 'Message yourself' : `Message ${member.name}`}
            disabled={openDm.isPending}
            onClick={() =>
              openDm.mutate(
                { userIds: isSelf ? [] : [member.userId] },
                {
                  onSuccess: (dm) => router.push(`/dms/${dm.id}`),
                  onError: (error) => toast.error(error.message),
                }
              )
            }
            className="absolute inset-0 size-auto rounded-xl bg-transparent! focus-visible:ring-0"
          />
        )}
      </Card>
    </li>
  );
}

export function DirectoryPeopleSkeleton() {
  return (
    <div role="status" aria-label="Loading people" className={grid}>
      {['w-24', 'w-28', 'w-20', 'w-32'].map((width) => (
        <div key={width} className="ring-foreground/10 rounded-xl ring-1">
          <Skeleton className="aspect-square rounded-b-none" />
          <div className="space-y-2 p-3">
            <Skeleton className={`h-4 ${width}`} />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Everyone in the workspace as cards, with a search, role and account filters, and a sort. */
export function DirectoryPeople() {
  const [params, setParams] = useQueryStates(peopleParams);
  const query = useDeferredValue(params);
  const { data: members, isPending, isError, refetch } = useQuery(membersQuery);
  const { data: session } = useQuery(sessionQuery);
  const people = findPeople(members ?? [], query);
  const filtered =
    params.q !== '' || params.role !== 'any' || params.account !== 'active';

  let results;
  if (isPending) results = <DirectoryPeopleSkeleton />;
  else if (isError) {
    results = (
      <DirectoryEmpty
        icon={IconAlertTriangle}
        title="Couldn't load people"
        description="Check your connection, then try again."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  } else if (people.length === 0) {
    results = filtered ? (
      <DirectoryEmpty
        icon={IconSearch}
        title="No one matches"
        description="Try another name, or clear the filters."
        action={{
          label: 'Clear filters',
          onClick: () => void setParams({ q: null, role: null, account: null }),
        }}
      />
    ) : (
      <DirectoryEmpty
        icon={IconUsers}
        title="No one here yet"
        description="Invite your team to start working together."
      />
    );
  } else {
    results = (
      <ul aria-label="People" className={grid}>
        {people.map((member) => (
          <DirectoryPerson
            key={member.memberId}
            member={member}
            isSelf={member.userId === session?.user.id}
          />
        ))}
      </ul>
    );
  }

  return (
    <>
      <DirectoryToolbar>
        <FilterSearch
          label="Search people"
          placeholder="Search by name or email"
          className="w-full sm:w-72"
        />
        <FilterSelect
          name="role"
          parser={peopleParams.role}
          options={PEOPLE_ROLES}
          label="Role"
        />
        <FilterSelect
          name="account"
          parser={peopleParams.account}
          options={PEOPLE_ACCOUNTS}
          label="Account"
        />
        <DirectoryToolbarEnd>
          <DirectoryCount count={people.length} one="person" many="people" />
          <FilterSelect
            name="sort"
            parser={peopleParams.sort}
            options={PEOPLE_SORTS}
            label="Sort people"
            icon={IconArrowsSort}
            align="end"
          />
        </DirectoryToolbarEnd>
      </DirectoryToolbar>
      <DirectoryResults>{results}</DirectoryResults>
    </>
  );
}
