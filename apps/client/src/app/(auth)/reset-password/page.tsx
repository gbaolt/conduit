'use client';

import { useQueryState } from 'nuqs';

import { AuthActionLink } from '@/features/auth/components/auth-action-link';
import { DirectionalTransition } from '@/features/auth/components/directional-transition';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export default function ResetPasswordPage() {
  const [callbackURL] = useQueryState('callbackURL');
  const [email] = useQueryState('email');

  return (
    <DirectionalTransition>
      <div className="mb-6 text-center">
        <h2 className="text-foreground mb-2 text-3xl font-medium tracking-tight">
          Set a new password
        </h2>
        <p className="text-muted-foreground text-base">
          Choose a new password for your account.
        </p>
      </div>

      <ResetPasswordForm emailFromQuery={email} callbackURL={callbackURL} />

      <AuthActionLink
        prompt="Back to"
        href="/sign-in"
        label="Sign in"
        callbackURL={callbackURL}
        transitionTypes={['nav-back']}
      />
    </DirectionalTransition>
  );
}
