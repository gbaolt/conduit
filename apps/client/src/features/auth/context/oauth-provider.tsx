'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { toAbsoluteAppUrl } from '@/lib/callback-url';
import { authClient } from '@/services/auth/client';

import type { OAuthProvider } from '../types/auth';

type OAuthContextValue = {
  pendingProvider: OAuthProvider | null;
  isOAuthPending: boolean;
  signInWith: (provider: OAuthProvider) => Promise<void>;
};

const OAuthContext = createContext<OAuthContextValue | null>(null);

function toastOAuthError(message: string) {
  toast.error(
    message.toLowerCase().includes('banned')
      ? 'Your account has been suspended'
      : 'Authentication failed. Please try again.'
  );
}

export function OAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(
    null
  );
  const didToastCallbackError = useRef(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (!error || didToastCallbackError.current) {
      return;
    }

    didToastCallbackError.current = true;
    toastOAuthError(error);
  }, [searchParams]);

  const signInWith = async (provider: OAuthProvider) => {
    setPendingProvider(provider);

    try {
      const callbackURL = searchParams.get('callbackURL');

      await authClient.signIn.social({
        provider,
        callbackURL: toAbsoluteAppUrl(callbackURL ?? '/'),
        errorCallbackURL: toAbsoluteAppUrl('/sign-in'),
        fetchOptions: {
          onError: (ctx) => {
            toastOAuthError(ctx.error?.message ?? '');
          },
        },
      });
    } finally {
      setPendingProvider(null);
      router.refresh();
    }
  };

  return (
    <OAuthContext.Provider
      value={{
        pendingProvider,
        isOAuthPending: pendingProvider !== null,
        signInWith,
      }}
    >
      {children}
    </OAuthContext.Provider>
  );
}

export function useOAuth() {
  const context = useContext(OAuthContext);

  if (!context) {
    throw new Error('useOAuth must be used within OAuthProvider');
  }

  return context;
}
