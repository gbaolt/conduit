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

import { FormCheckbox } from '@/components/form/form-checkbox';
import { FormInput } from '@/components/form/form-input';
import { type ButtonStatus, StatusButton } from '@/components/status-button';
import { withCallbackURL } from '@/features/auth/lib/callback-url';
import { verifyEmailPath } from '@/features/auth/lib/email-otp-type';
import { navigateWithTransition } from '@/features/auth/lib/navigate-with-transition';
import { SignUpSchema } from '@/features/auth/lib/validations';
import { authClient } from '@/services/auth/client';

type SignUpFormValues = z.infer<typeof SignUpSchema>;

type SignUpFormProps = {
  callbackURL: string | null;
  isOAuthPending: boolean;
};

export function SignUpForm({ callbackURL, isOAuthPending }: SignUpFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ButtonStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState, reset } = useForm<SignUpFormValues>(
    {
      resolver: standardSchemaResolver(SignUpSchema),
      defaultValues: {
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        terms: false,
      },
    }
  );

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    const succeeded = await handleSubmit(async (values) => {
      setError(null);
      setStatus('loading');

      const response = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      });

      if (response?.data?.user) {
        setStatus('success');
        navigateWithTransition({
          router,
          href: withCallbackURL(
            verifyEmailPath({
              email: values.email,
              type: 'email-verification',
            }),
            callbackURL
          ) as Route,
          type: 'nav-forward',
        });
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

  const isDisabled = isOAuthPending || formState.isSubmitting;

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <FieldGroup>
        <FormInput
          control={control}
          name="name"
          autoComplete="name"
          label="Name"
          placeholder="Conduit"
        />
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
          autoComplete="new-password"
          label="Password"
          placeholder="********"
        />
        <FormInput
          control={control}
          name="confirmPassword"
          type="password"
          label="Confirm your password"
          placeholder="********"
        />
        <FormCheckbox
          control={control}
          name="terms"
          label={'I agree to all Terms and Privacy Policy.'}
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
        disabled={isDisabled}
        successLabel="Account created"
      >
        Create account
      </StatusButton>
    </form>
  );
}
