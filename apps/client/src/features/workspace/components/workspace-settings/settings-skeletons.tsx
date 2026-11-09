import { Skeleton } from '@conduit/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@conduit/ui/components/table';

import { SettingsPanel } from './settings-view';

/** Stands in for a settings view while the admin check runs: the 32px title, the 20px line, and a panel. */
export function SettingsPageSkeleton() {
  return (
    <div role="status" aria-label="Loading settings">
      <div className="flex flex-col gap-1.5 pb-8">
        <div className="flex h-8 items-center">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-72" />
        </div>
      </div>
      <Skeleton className="h-27 w-full rounded-xl" />
    </div>
  );
}

const ROWS = ['w-48', 'w-40', 'w-56'];

/** Stands in for `InvitationsTable`: its real header row and three 49px rows. */
export function SettingsInvitationsSkeleton() {
  return (
    <SettingsPanel>
      <Table aria-label="Loading invitations">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="ps-4">Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden sm:table-cell">Invited by</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Expires
            </TableHead>
            <TableHead className="w-24 pe-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody aria-hidden>
          {ROWS.map((width) => (
            <TableRow key={width} className="hover:bg-transparent">
              <TableCell className="py-3 ps-4">
                <Skeleton className={`h-4 ${width}`} />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-14" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="ms-auto h-4 w-20" />
              </TableCell>
              <TableCell className="pe-4">
                <Skeleton className="ms-auto h-8 w-17 rounded-md" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsPanel>
  );
}
