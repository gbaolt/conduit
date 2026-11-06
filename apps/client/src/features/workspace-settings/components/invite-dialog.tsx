'use client';

import type { CreateInvitationsResult, InviteRole } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { Label } from '@conduit/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { Textarea } from '@conduit/ui/components/textarea';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import { useCreateInvitations } from '@/services/workspaces/hooks';

const ROLE_LABELS = { member: 'Member', admin: 'Admin' } as const;
const MAX_EMAILS = 20;
const EmailSchema = z.email();

const SKIP_REASONS = {
  member: 'already a member',
  invited: 'already invited',
} as const;

function parseEmails(text: string) {
  const emails = text.split(/[\s,;]+/).filter(Boolean);
  return {
    emails,
    invalid: emails.find((email) => !EmailSchema.safeParse(email).success),
  };
}

function InviteResult({ result }: { result: CreateInvitationsResult }) {
  return (
    <div className="flex flex-col gap-3 text-sm" role="status">
      {result.sent.length > 0 ? (
        <p>
          Sent {result.sent.length}{' '}
          {result.sent.length === 1 ? 'invitation' : 'invitations'} to{' '}
          {result.sent.join(', ')}.
        </p>
      ) : null}
      {result.skipped.length > 0 ? (
        <div>
          <p className="text-muted-foreground">Skipped</p>
          <ul>
            {result.skipped.map(({ email, reason }) => (
              <li key={email}>
                {email}, {SKIP_REASONS[reason]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Invites by email. A later invite path, such as the join link, adds its section here. */
export function InviteDialog({
  workspaceName,
  open,
  onOpenChange,
}: {
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createInvitations = useCreateInvitations();
  const [text, setText] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [result, setResult] = useState<CreateInvitationsResult | null>(null);

  const { emails, invalid } = parseEmails(text);
  const error =
    emails.length > MAX_EMAILS
      ? `Invite up to ${MAX_EMAILS} people at a time.`
      : invalid
        ? `Not a valid email: ${invalid}`
        : null;

  const reset = () => {
    setText('');
    setResult(null);
    createInvitations.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (emails.length === 0 || error) return;
    createInvitations.mutate(
      { emails, role },
      {
        onSuccess: setResult,
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite people to {workspaceName}</DialogTitle>
          <DialogDescription>
            They get an email with a link that is valid for 7 days.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <>
            <InviteResult result={result} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Invite more
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-emails">Email addresses</Label>
              <Textarea
                id="invite-emails"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="name@example.com, another@example.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'invite-emails-error' : undefined}
                autoFocus
              />
              {error ? (
                <p
                  id="invite-emails-error"
                  role="alert"
                  className="text-destructive text-sm"
                >
                  {error}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                items={ROLE_LABELS}
                value={role}
                onValueChange={(value) => setRole(value as InviteRole)}
              >
                <SelectTrigger id="invite-role" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <StatusButton
                type="submit"
                disabled={emails.length === 0 || error !== null}
                status={createInvitations.isPending ? 'loading' : 'idle'}
              >
                Send invitations
              </StatusButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
