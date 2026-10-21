'use client';

import { FieldSeparator } from '@conduit/ui/components/field';
import { useSearchParams } from 'next/navigation';

import { AuthActionLink } from '@/features/auth/components/auth-action-link';
import { DirectionalTransition } from '@/features/auth/components/directional-transition';
import { OAuthForm } from '@/features/auth/components/oauth-form';
import { SignUpForm } from '@/features/auth/components/sign-up-form';
import {
  OAuthProvider,
  useOAuth,
} from '@/features/auth/context/oauth-provider';

function SignUpContent({ callbackURL }: { callbackURL: string | null }) {
  const { isOAuthPending } = useOAuth();

  return (
    <div className="flex flex-col gap-6">
      <OAuthForm />
      <FieldSeparator>Or continue with</FieldSeparator>
      <SignUpForm callbackURL={callbackURL} isOAuthPending={isOAuthPending} />
    </div>
  );
}

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get('callbackURL');

  return (
    <DirectionalTransition>
      <div className="mb-6 text-center">
        <h2 className="text-foreground mb-2 text-3xl font-medium tracking-tight">
          Create your Account
        </h2>
        <p className="text-muted-foreground text-base">
          Join the AIO platform where teams connect and collaborate.
        </p>
      </div>

      <OAuthProvider>
        <SignUpContent callbackURL={callbackURL} />
      </OAuthProvider>

      <AuthActionLink
        prompt="Already have an account?"
        href="/sign-in"
        label="Sign in"
        callbackURL={callbackURL}
      />
    </DirectionalTransition>
  );
}
