'use client';

import { DomainSchema } from '@conduit/contract';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { Textarea } from '@conduit/ui/components/textarea';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import {
  useAllowedDomains,
  useSetAllowedDomains,
} from '@/services/workspaces/hooks';

function parseDomains(text: string) {
  const domains = text
    .split(/[\s,;]+/)
    .map((domain) => domain.replace(/^@/, ''))
    .filter(Boolean);
  return {
    domains,
    invalid: domains.find((domain) => !DomainSchema.safeParse(domain).success),
  };
}

export function AllowedDomainsForm() {
  const { data, isError, error } = useAllowedDomains();
  const set = useSetAllowedDomains();
  const [draft, setDraft] = useState<string | null>(null);

  if (isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error.message}
      </p>
    );
  }
  if (!data) return <Skeleton className="h-24 w-full" />;

  const text = draft ?? data.join('\n');
  const { domains, invalid } = parseDomains(text);
  const problem = invalid ? `Not a valid domain: ${invalid}` : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem) return;
    set.mutate(
      { domains },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success('Allowed domains saved.');
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div className="flex flex-col gap-2">
        <Textarea
          id="allowed-domains"
          aria-labelledby="domains-heading"
          value={text}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={'acme.dev\nacme.co.uk'}
          className="min-h-28"
          aria-invalid={problem ? true : undefined}
          aria-describedby="allowed-domains-hint"
        />
        <p
          id="allowed-domains-hint"
          role={problem ? 'alert' : undefined}
          className={
            problem
              ? 'text-destructive text-sm'
              : 'text-muted-foreground text-sm'
          }
        >
          {problem ??
            'One domain per line. A subdomain such as eng.acme.dev does not match acme.dev.'}
        </p>
      </div>
      <div className="flex justify-end">
        <StatusButton
          type="submit"
          disabled={problem !== null || draft === null}
          status={set.isPending ? 'loading' : 'idle'}
        >
          Save domains
        </StatusButton>
      </div>
    </form>
  );
}
