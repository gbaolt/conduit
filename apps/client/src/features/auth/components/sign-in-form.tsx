'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@conduit/ui/components/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@conduit/ui/components/alert-dialog';
import { FieldGroup } from '@conduit/ui/components/field';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { IconAlertCircle } from '@tabler/icons-react';
import type { ErrorContext } from 'better-auth/react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { FormInput } from '@/components/form/form-input';
import { type ButtonStatus, StatusButton } from '@/components/status-button';
import {
  isSafeInternalPath,
  withCallbackURL,
} from '@/features/auth/lib/callback-url';
import { verifyEmailPath } from '@/features/auth/lib/email-otp-type';
import { navigateWithTransition } from '@/features/auth/lib/navigate-with-transition';
import { SignInSchema } from '@/features/auth/lib/validations';
import { authClient } from '@/services/auth/client';

import { AuthActionLink } from './auth-action-link';

type SignInFormValues = z.infer<typeof SignInSchema>;

type SignInFormProps = {
  callbackURL: string | null;
  isOAuthPending: boolean;
};

type SignInError = ErrorContext['error'];

function isUnverifiedEmailError(error: SignInError) {
  return (
    error?.code?.toLowerCase() === 'email_not_verified' &&
    (error?.statusCode === undefined || error?.statusCode === 403)
  );
}

export function SignInForm({ callbackURL, isOAuthPending }: SignInFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ButtonStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [openUnverifiedDialog, setOpenUnverifiedDialog] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const { control, handleSubmit, formState, reset } = useForm<SignInFormValues>(
    {
      resolver: standardSchemaResolver(SignInSchema),
      defaultValues: {
        email: '',
        password: '',
      },
    }
  );

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    const succeeded = await handleSubmit(async (values) => {
      setError(null);
      setStatus('loading');

      const response = await authClient.signIn.email(
        {
          email: values.email,
          password: values.password,
        },
        {
          onError: ({ error }) => {
            if (isUnverifiedEmailError(error)) {
              setUnverifiedEmail(values.email);
              setOpenUnverifiedDialog(true);
              return;
            }
          },
        }
      );

      if (response?.data?.user) {
        setStatus('success');
        router.push(
          (isSafeInternalPath(callbackURL) ? callbackURL : '/') as Route
        );
        router.refresh();
        return true;
      }

      setError(response?.error?.message || 'Something went wrong.');
      setStatus('idle');
      return false;
    })(event);

    if (succeeded) {
      reset();
    }
  };

  return (
    <>
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <FieldGroup>
          <FormInput
            control={control}
            name="email"
            autoComplete="email"
            label="Email"
            placeholder="example@conduit.com"
          />
          <FormInput
            control={control}
            name="password"
            type="password"
            autoComplete="current-password"
            label="Password"
            placeholder="********"
            labelAction={
              <AuthActionLink
                href="/forgot-password"
                label="Forgot password?"
                callbackURL={callbackURL}
                className="mt-0"
                linkClassName="text-muted-foreground text-xs hover:text-foreground"
                tabIndex={-1}
                transitionTypes={['nav-forward']}
              />
            }
          />
        </FieldGroup>

        {!!error && (
          <Alert
            variant="destructive"
            className="bg-destructive/10 border-destructive/20 border"
          >
            <IconAlertCircle />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="text-wrap">
              {error}
              {error === 'Invalid email or password' && '. Please try again.'}
            </AlertDescription>
          </Alert>
        )}

        <StatusButton
          type="submit"
          status={status}
          onStatusChange={setStatus}
          size="lg"
          className="w-full"
          disabled={isOAuthPending || formState.isSubmitting}
          successLabel="Signed in"
        >
          Sign in
        </StatusButton>
      </form>

      <AlertDialog
        open={openUnverifiedDialog}
        onOpenChange={setOpenUnverifiedDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify your email first</AlertDialogTitle>
            <AlertDialogDescription>
              Your account is not verified yet. Continue to the verification
              page to enter your code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpenUnverifiedDialog(false);
                navigateWithTransition({
                  router,
                  href: withCallbackURL(
                    verifyEmailPath({
                      email: unverifiedEmail,
                      type: 'email-verification',
                    }),
                    callbackURL
                  ) as Route,
                  type: 'nav-forward',
                });
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
