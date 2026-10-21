'use client';

import { Button } from '@conduit/ui/components/button';
import { Spinner } from '@conduit/ui/components/spinner';

import { GitHubIcon, GoogleIcon } from '@/components/icons';

import { useOAuth } from '../context/oauth-provider';
import type { OAuthProvider } from '../types/auth';

export const OAuthForm = () => {
  const { pendingProvider, isOAuthPending, signInWith } = useOAuth();

  const renderButtonContent = (provider: OAuthProvider) => {
    if (pendingProvider === provider) {
      return (
        <>
          <Spinner className="text-muted-foreground" data-icon="inline-start" />
          <span>Redirecting...</span>
        </>
      );
    }

    switch (provider) {
      case 'google':
        return (
          <>
            <GoogleIcon data-icon="inline-start" />
            <span className="max-lg:hidden">Continue with Google</span>
          </>
        );
      case 'github':
        return (
          <>
            <GitHubIcon data-icon="inline-start" />
            <span className="max-lg:hidden">Continue with GitHub</span>
          </>
        );
      default: {
        const exhaustiveCheck: never = provider;
        return exhaustiveCheck;
      }
    }
  };

  const handleSignIn = async (provider: OAuthProvider) => {
    await signInWith(provider);
  };

  return (
    <div className="flex gap-2 lg:flex-col">
      <Button
        variant="outline"
        className="btn-outline max-lg:flex-1"
        disabled={isOAuthPending}
        onClick={() => void handleSignIn('google')}
      >
        {renderButtonContent('google')}
      </Button>
      <Button
        variant="outline"
        className="btn-outline max-lg:flex-1"
        disabled={isOAuthPending}
        onClick={() => void handleSignIn('github')}
      >
        {renderButtonContent('github')}
      </Button>
    </div>
  );
};
