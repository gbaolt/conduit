'use client';

import type {
  CanvasDocument,
  CanvasMember,
  CanvasRole,
  WorkspaceMember,
} from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@conduit/ui/components/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@conduit/ui/components/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { UserAvatar } from '@/components/user-avatar';
import { sessionQuery } from '@/services/auth/queries';
import {
  useRemoveCanvasMember,
  useShareCanvas,
  useUpdateCanvasMemberRole,
} from '@/services/canvases/hooks';
import { canvasMembersQuery } from '@/services/canvases/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

const ROLES = [
  { value: 'editor', label: 'Can edit' },
  { value: 'viewer', label: 'Can view' },
] satisfies { value: CanvasRole; label: string }[];

type Person = Pick<WorkspaceMember, 'userId' | 'name' | 'email' | 'image'>;

function CanvasShareDialogRole({
  value,
  onChange,
  disabled,
  label,
}: {
  value: CanvasRole;
  onChange: (role: CanvasRole) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Select
      items={ROLES}
      value={value}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next)}
    >
      <SelectTrigger size="sm" aria-label={label} className="w-28 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {ROLES.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Picks workspace members the canvas is not shared with yet, and a role for all of them. */
function CanvasShareDialogInvite({
  canvasId,
  sharedWith,
}: {
  canvasId: string;
  sharedWith: ReadonlySet<string>;
}) {
  const inputId = useId();
  const anchor = useComboboxAnchor();
  const share = useShareCanvas();
  const { data: workspaceMembers = [] } = useWorkspaceMembers();
  const [selected, setSelected] = useState<Person[]>([]);
  const [role, setRole] = useState<CanvasRole>('editor');
  const people = workspaceMembers.filter(
    (member) => member.status === 'active' && !sharedWith.has(member.userId)
  );

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>Add people</FieldLabel>
      <div className="flex items-start gap-2">
        <Combobox
          multiple
          autoHighlight
          items={people}
          value={selected}
          onValueChange={setSelected}
          itemToStringLabel={(person: Person) => person.name}
          isItemEqualToValue={(a: Person, b: Person) => a.userId === b.userId}
        >
          <ComboboxChips ref={anchor} className="min-w-0 flex-1">
            <ComboboxValue>
              {(values: Person[]) => (
                <>
                  {values.map((person) => (
                    <ComboboxChip key={person.userId}>
                      {person.name}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    id={inputId}
                    placeholder={selected.length ? '' : 'Search people'}
                  />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>Everyone already has access.</ComboboxEmpty>
            <ComboboxList>
              {(person: Person) => (
                <ComboboxItem key={person.userId} value={person}>
                  <UserAvatar
                    name={person.name}
                    image={person.image}
                    className="size-5 text-[10px]"
                  />
                  <span className="truncate">{person.name}</span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <CanvasShareDialogRole
          value={role}
          onChange={setRole}
          label="Role for the people you add"
        />
      </div>
      <StatusButton
        className="self-end"
        disabled={!selected.length}
        status={share.isPending ? 'loading' : 'idle'}
        onClick={() =>
          share.mutate(
            {
              canvasId,
              userIds: selected.map((person) => person.userId),
              role,
            },
            {
              onSuccess: () => setSelected([]),
              onError: (error) => toast.error(error.message),
            }
          )
        }
      >
        Share
      </StatusButton>
    </Field>
  );
}

function CanvasShareDialogMember({
  canvasId,
  member,
  canManage,
  isViewer,
  onLeft,
}: {
  canvasId: string;
  member: CanvasMember;
  canManage: boolean;
  isViewer: boolean;
  onLeft: () => void;
}) {
  const updateRole = useUpdateCanvasMemberRole();
  const remove = useRemoveCanvasMember();
  const onError = (error: Error) => toast.error(error.message);

  return (
    <li className="flex items-center gap-3 py-2">
      <UserAvatar
        name={member.name}
        image={member.image}
        className="size-8 shrink-0 text-xs"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name}
          {isViewer && <span className="text-muted-foreground"> (you)</span>}
        </p>
        <p className="text-muted-foreground truncate text-xs">{member.email}</p>
      </div>
      <CanvasShareDialogRole
        value={member.role}
        disabled={!canManage || updateRole.isPending}
        label={`Role for ${member.name}`}
        onChange={(role) =>
          updateRole.mutate(
            { canvasId, userId: member.userId, role },
            { onError }
          )
        }
      />
      {(canManage || isViewer) && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={isViewer ? 'Leave canvas' : `Remove ${member.name}`}
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(
              { canvasId, userId: member.userId },
              { onSuccess: isViewer ? onLeft : undefined, onError }
            )
          }
        >
          <IconX />
        </Button>
      )}
    </li>
  );
}

const MEMBER_SKELETONS = ['w-28', 'w-36'];

/** Who a standalone canvas is shared with. Anyone who can edit it adds people, changes roles, and removes people. */
export function CanvasShareDialog({
  canvas,
  open,
  onOpenChange,
}: {
  canvas: CanvasDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data: session } = useQuery(sessionQuery);
  const members = useQuery({ ...canvasMembersQuery(canvas.id), enabled: open });
  const canManage = canvas.access.manageSharing;
  const sharedWith = new Set(members.data?.map((member) => member.userId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{canvas.title}”</DialogTitle>
          <DialogDescription>
            Only the people listed here can open this canvas.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {canManage && (
            <CanvasShareDialogInvite
              canvasId={canvas.id}
              sharedWith={sharedWith}
            />
          )}
          <ul aria-label="People with access" className="-my-2 divide-y">
            {members.isPending &&
              MEMBER_SKELETONS.map((width) => (
                <li key={width} className="flex items-center gap-3 py-2">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className={`h-4 ${width}`} />
                </li>
              ))}
            {members.data?.map((member) => (
              <CanvasShareDialogMember
                key={member.userId}
                canvasId={canvas.id}
                member={member}
                canManage={canManage}
                isViewer={member.userId === session?.user.id}
                onLeft={() => router.push('/canvases')}
              />
            ))}
          </ul>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
