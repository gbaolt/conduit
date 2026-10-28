'use client';

import { useCallback } from 'react';

import { StatusButton } from '@/components/async/status-button';
import { GitHubIcon, GoogleIcon } from '@/components/icons';

import { useOAuth } from '../context/oauth-provider';
import type { OAuthProvider } from '../types/auth';

export const OAuthForm = () => {
  const { pendingProvider, isOAuthPending, signInWith } = useOAuth();

  const getStatus = useCallback(
    (provider: OAuthProvider) =>
      pendingProvider === provider ? 'loading' : 'idle',
    [pendingProvider]
  );

  return (
    <div className="flex gap-2 lg:flex-col">
      <StatusButton
        variant="outline"
        className="btn-outline max-lg:flex-1"
        status={getStatus('google')}
        disabled={isOAuthPending}
        onClick={() => void signInWith('google')}
      >
        <GoogleIcon data-icon="inline-start" />
        <span className="max-lg:hidden">Continue with Google</span>
      </StatusButton>
      <StatusButton
        variant="outline"
        className="btn-outline max-lg:flex-1"
        status={getStatus('github')}
        disabled={isOAuthPending}
        onClick={() => void signInWith('github')}
      >
        <GitHubIcon data-icon="inline-start" />
        <span className="max-lg:hidden">Continue with GitHub</span>
      </StatusButton>
    </div>
  );
};
