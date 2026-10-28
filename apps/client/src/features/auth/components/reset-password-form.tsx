'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@conduit/ui/components/alert';
import { FieldGroup } from '@conduit/ui/components/field';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { IconAlertCircle } from '@tabler/icons-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  type ButtonStatus,
  StatusButton,
} from '@/components/async/status-button';
import { FormInput } from '@/components/form/form-input';
import { withCallbackURL } from '@/features/auth/lib/callback-url';
import { verifyEmailPath } from '@/features/auth/lib/email-otp-type';
import { navigateWithTransition } from '@/features/auth/lib/navigate-with-transition';
import {
  clearResetPasswordOtp,
  readResetPasswordOtp,
} from '@/features/auth/lib/reset-password-otp';
import { ResetPasswordSchema } from '@/features/auth/lib/validations';
import { authClient } from '@/services/auth/client';

type ResetPasswordFormValues = z.infer<typeof ResetPasswordSchema>;

type ResetPasswordFormProps = {
  emailFromQuery: string | null;
  callbackURL: string | null;
};

function forgetPasswordVerifyHref(
  email: string,
  callbackURL: string | null
): Route {
  return withCallbackURL(
    verifyEmailPath({ email, type: 'forget-password' }),
    callbackURL
  ) as Route;
}

export function ResetPasswordForm({
  emailFromQuery,
  callbackURL,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ButtonStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const parsedEmailFromQuery =
    ResetPasswordSchema.shape.email.safeParse(emailFromQuery);
  const validEmailFromQuery = parsedEmailFromQuery.success
    ? parsedEmailFromQuery.data
    : null;
  const [canReset, setCanReset] = useState(!validEmailFromQuery);

  const { control, handleSubmit, formState, reset } =
    useForm<ResetPasswordFormValues>({
      resolver: standardSchemaResolver(ResetPasswordSchema),
      defaultValues: {
        email: validEmailFromQuery ?? '',
        password: '',
        confirmPassword: '',
      },
    });

  useEffect(() => {
    if (!validEmailFromQuery) {
      setCanReset(true);
      return;
    }

    if (readResetPasswordOtp(validEmailFromQuery) !== null) {
      setCanReset(true);
      return;
    }

    router.replace(forgetPasswordVerifyHref(validEmailFromQuery, callbackURL));
  }, [callbackURL, router, validEmailFromQuery]);

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    const succeeded = await handleSubmit(async (values) => {
      setError(null);
      setStatus('loading');

      const otp = readResetPasswordOtp(values.email);
      if (!otp) {
        setStatus('idle');
        router.replace(forgetPasswordVerifyHref(values.email, callbackURL));
        return false;
      }

      const response = await authClient.emailOtp.resetPassword({
        email: values.email,
        otp,
        password: values.password,
      });

      if (response?.data) {
        clearResetPasswordOtp();
        setStatus('success');
        navigateWithTransition({
          router,
          href: withCallbackURL('/sign-in', callbackURL) as Route,
          type: 'nav-back',
        });
        return true;
      }

      setError(response?.error?.message || 'Something went wrong');
      setStatus('idle');
      return false;
    })(event);

    if (succeeded) {
      reset();
    }
  };

  if (!canReset) {
    return null;
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <FieldGroup>
        {!validEmailFromQuery && (
          <FormInput
            control={control}
            name="email"
            type="email"
            autoComplete="email"
            label="Email"
            placeholder="example@conduit.com"
          />
        )}
        <FormInput
          control={control}
          name="password"
          type="password"
          autoComplete="new-password"
          label="New password"
          placeholder="********"
        />
        <FormInput
          control={control}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          label="Confirm password"
          placeholder="********"
        />
      </FieldGroup>

      {!!error && (
        <Alert
          variant="destructive"
          className="bg-destructive/10 border-destructive/20 border"
        >
          <IconAlertCircle />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="text-wrap">{error}</AlertDescription>
        </Alert>
      )}

      <StatusButton
        type="submit"
        status={status}
        onStatusChange={setStatus}
        size="lg"
        className="w-full"
        disabled={formState.isSubmitting}
        successLabel="Password updated"
      >
        Reset password
      </StatusButton>
    </form>
  );
}
