'use client';

import { FieldSeparator } from '@conduit/ui/components/field';
import { useSearchParams } from 'next/navigation';

import { AuthActionLink } from '@/features/auth/components/auth-action-link';
import { DirectionalTransition } from '@/features/auth/components/directional-transition';
import { OAuthForm } from '@/features/auth/components/oauth-form';
import { SignInForm } from '@/features/auth/components/sign-in-form';
import {
  OAuthProvider,
  useOAuth,
} from '@/features/auth/context/oauth-provider';

function SignInContent({ callbackURL }: { callbackURL: string | null }) {
  const { isOAuthPending } = useOAuth();

  return (
    <div className="flex flex-col gap-6">
      <OAuthForm />
      <FieldSeparator>Or continue with</FieldSeparator>
      <SignInForm callbackURL={callbackURL} isOAuthPending={isOAuthPending} />
    </div>
  );
}

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get('callbackURL');

  return (
    <DirectionalTransition>
      <div className="mb-6 text-center">
        <h2 className="text-foreground mb-2 text-3xl font-medium tracking-tight">
          Sign In
        </h2>
        <p className="text-muted-foreground text-base">
          Manage your team&apos;s work in one place.
        </p>
      </div>

      <OAuthProvider>
        <SignInContent callbackURL={callbackURL} />
      </OAuthProvider>

      <AuthActionLink
        prompt="Don't have an account?"
        href="/sign-up"
        label="Sign up"
        callbackURL={callbackURL}
      />
    </DirectionalTransition>
  );
}
