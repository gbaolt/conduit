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
import { type SyntheticEvent, useState } from 'react';
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
import { ForgotPasswordSchema } from '@/features/auth/lib/validations';
import { authClient } from '@/services/auth/client';

type ForgotPasswordFormValues = z.infer<typeof ForgotPasswordSchema>;

type ForgotPasswordFormProps = {
  callbackURL: string | null;
};

export function ForgotPasswordForm({ callbackURL }: ForgotPasswordFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ButtonStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState, reset } =
    useForm<ForgotPasswordFormValues>({
      resolver: standardSchemaResolver(ForgotPasswordSchema),
      defaultValues: {
        email: '',
      },
    });

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    const succeeded = await handleSubmit(async (values) => {
      setError(null);
      setStatus('loading');

      const response = await authClient.emailOtp.requestPasswordReset({
        email: values.email,
      });

      if (response?.data) {
        setStatus('success');
        navigateWithTransition({
          router,
          href: withCallbackURL(
            verifyEmailPath({
              email: values.email,
              type: 'forget-password',
            }),
            callbackURL
          ) as Route,
          type: 'nav-forward',
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

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <FieldGroup>
        <FormInput
          control={control}
          name="email"
          type="email"
          autoComplete="email"
          label="Email"
          placeholder="example@conduit.com"
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
        successLabel="Reset code sent"
      >
        Continue
      </StatusButton>
    </form>
  );
}
