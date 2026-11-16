'use client';

import { useQueryState } from 'nuqs';

import { AuthActionLink } from '@/features/auth/components/auth-action-link';
import { DirectionalTransition } from '@/features/auth/components/directional-transition';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

export default function ForgotPasswordPage() {
  const [callbackURL] = useQueryState('callbackURL');

  return (
    <DirectionalTransition>
      <div className="mb-6 text-center">
        <h2 className="text-foreground mb-2 text-3xl font-medium tracking-tight">
          Forgot your password?
        </h2>
        <p className="text-muted-foreground text-base">
          We will send you a code to reset it.
        </p>
      </div>

      <ForgotPasswordForm callbackURL={callbackURL} />

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
