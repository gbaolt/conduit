'use client';

import {
  canWorkspace,
  type CreateInvitationsResult,
  type InviteRole,
} from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import {
  InputGroup,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import { Label } from '@conduit/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { Tag } from '@conduit/ui/components/tag';
import { IconLink } from '@tabler/icons-react';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusButton } from '@/components/async/status-button';
import {
  useCreateInvitations,
  useWorkspaceRole,
} from '@/services/workspaces/hooks';

import { useCopyJoinLink } from './join-link-section';

const ROLE_LABELS = { member: 'Member', admin: 'Admin' } as const;
const MAX_EMAILS = 20;
const EmailSchema = z.email();

const SKIP_REASONS = {
  member: 'already a member',
  invited: 'already invited',
} as const;

const SEPARATORS = /[\s,;]+/;

const isEmail = (email: string) => EmailSchema.safeParse(email).success;

/** Adds the typed or pasted addresses to the list once each, ignoring case. */
function addEmails(emails: string[], text: string) {
  const seen = new Set(emails.map((email) => email.toLowerCase()));
  const added = text
    .split(SEPARATORS)
    .filter(Boolean)
    .filter((email) => {
      const key = email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return added.length ? [...emails, ...added] : emails;
}

/**
 * The addresses as tags, with the one being typed after them. Space, comma, semicolon or Enter turns the text
 * into a tag, a paste of many becomes many, and Backspace in the empty field takes the last tag back to edit.
 */
function InviteEmails({
  emails,
  onEmailsChange,
  text,
  onTextChange,
  error,
}: {
  emails: string[];
  onEmailsChange: (emails: string[]) => void;
  text: string;
  onTextChange: (text: string) => void;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const change = (value: string) => {
    // Every separator ends an address, so only what follows the last one stays as text.
    const parts = value.split(SEPARATORS);
    const rest = parts.pop() ?? '';
    if (parts.length) onEmailsChange(addEmails(emails, parts.join(' ')));
    onTextChange(rest);
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && text.trim()) {
      event.preventDefault();
      change(`${text} `);
    }
    if (event.key === 'Backspace' && !text && emails.length) {
      event.preventDefault();
      onTextChange(emails.at(-1) ?? '');
      onEmailsChange(emails.slice(0, -1));
    }
  };

  return (
    <InputGroup
      className="h-auto min-h-24 flex-wrap content-start items-start gap-1 p-1.5"
      onClick={() => inputRef.current?.focus()}
    >
      {emails.map((email) => (
        <Tag
          key={email}
          showCloseButton
          closeLabel={`Remove ${email}`}
          aria-invalid={!isEmail(email) || undefined}
          onClose={() => {
            onEmailsChange(emails.filter((other) => other !== email));
            inputRef.current?.focus();
          }}
        >
          {email}
        </Tag>
      ))}
      <InputGroupInput
        ref={inputRef}
        id="invite-emails"
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={keyDown}
        onBlur={() => text.trim() && change(`${text} `)}
        placeholder={emails.length ? '' : 'name@example.com'}
        className="h-6 min-w-40 px-1"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'invite-emails-error' : undefined}
        autoFocus
      />
    </InputGroup>
  );
}

// Resetting the link lives on Settings > Access; the invite dialog only shares it.
function CopyJoinLinkButton() {
  const { data: link, copy } = useCopyJoinLink();

  return (
    <Button type="button" variant="ghost" disabled={!link} onClick={copy}>
      <IconLink data-icon="inline-start" />
      Copy join link
    </Button>
  );
}

function InviteResult({ result }: { result: CreateInvitationsResult }) {
  return (
    <div className="flex flex-col gap-3 text-sm" role="status">
      {result.sent.length > 0 && (
        <p>
          Sent {result.sent.length}{' '}
          {result.sent.length === 1 ? 'invitation' : 'invitations'} to{' '}
          {result.sent.join(', ')}.
        </p>
      )}
      {result.skipped.length > 0 && (
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
      )}
    </div>
  );
}

/** Invites by email, and for an admin shares the join link. */
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
  const canShareLink = canWorkspace('manageJoinLink', useWorkspaceRole());
  const [emails, setEmails] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [result, setResult] = useState<CreateInvitationsResult | null>(null);

  // The address still being typed counts, so Send works without pressing Space first.
  const all = addEmails(emails, text);
  const invalid = all.find((email) => !isEmail(email));
  const invalidError = invalid ? `Not a valid email: ${invalid}` : null;
  const error =
    all.length > MAX_EMAILS
      ? `Invite up to ${MAX_EMAILS} people at a time.`
      : invalidError;

  const reset = () => {
    setEmails([]);
    setText('');
    setResult(null);
    createInvitations.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (all.length === 0 || error) return;
    createInvitations.mutate(
      { emails: all, role },
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
      <DialogContent className="sm:max-w-md">
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
              <InviteEmails
                emails={emails}
                onEmailsChange={setEmails}
                text={text}
                onTextChange={setText}
                error={error}
              />

              {error && (
                <p
                  id="invite-emails-error"
                  role="alert"
                  className="text-destructive text-sm"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="invite-role">Invite as</Label>
              <Select
                items={ROLE_LABELS}
                value={role}
                onValueChange={(value) => setRole(value as InviteRole)}
              >
                <SelectTrigger id="invite-role" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="sm:justify-between">
              {canShareLink ? <CopyJoinLinkButton /> : <span />}
              <StatusButton
                type="submit"
                disabled={all.length === 0 || error !== null}
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
