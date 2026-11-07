import { Suspense } from 'react';

import { AcceptInvitation } from '@/features/onboarding/components/accept-invitation';
import { requireSession } from '@/services/auth/server';

async function AcceptInvitationContent({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const [{ id }, session] = await Promise.all([searchParams, requireSession()]);

  return (
    <AcceptInvitation invitationId={id ?? ''} email={session.user.email} />
  );
}

export default function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <Suspense>
      <AcceptInvitationContent searchParams={searchParams} />
    </Suspense>
  );
}
