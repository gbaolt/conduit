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
import { FormInputOTP } from '@/components/form/form-otp';
import {
  isSafeInternalPath,
  withCallbackURL,
} from '@/features/auth/lib/callback-url';
import {
  emailOtpCopyFor,
  type EmailOtpType,
} from '@/features/auth/lib/email-otp-type';
import { navigateWithTransition } from '@/features/auth/lib/navigate-with-transition';
import { stashResetPasswordOtp } from '@/features/auth/lib/reset-password-otp';
import { EmailOtpSchema } from '@/features/auth/lib/validations';
import { authClient } from '@/services/auth/client';

type VerifyEmailFormValues = z.infer<typeof EmailOtpSchema>;

type VerifyEmailFormProps = {
  type: EmailOtpType;
  emailFromQuery: string | null;
  callbackURL: string | null;
};

export function VerifyEmailForm({
  type: emailType,
  emailFromQuery,
  callbackURL,
}: VerifyEmailFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ButtonStatus>('idle');
  const [resendStatus, setResendStatus] = useState<ButtonStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const parsedEmailFromQuery =
    EmailOtpSchema.shape.email.safeParse(emailFromQuery);
  const validEmailFromQuery = parsedEmailFromQuery.success
    ? parsedEmailFromQuery.data
    : null;
  const copy = emailOtpCopyFor(emailType);

  const { control, handleSubmit, getValues, formState, reset } =
    useForm<VerifyEmailFormValues>({
      resolver: standardSchemaResolver(EmailOtpSchema),
      defaultValues: {
        email: validEmailFromQuery ?? '',
        otp: '',
      },
    });

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    const succeeded = await handleSubmit(async (values) => {
      setError(null);
      setStatus('loading');

      switch (emailType) {
        case 'email-verification': {
          const response = await authClient.emailOtp.verifyEmail({
            email: values.email,
            otp: values.otp,
          });

          if (response?.data) {
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
        }
        case 'forget-password': {
          const response = await authClient.emailOtp.checkVerificationOtp({
            email: values.email,
            type: 'forget-password',
            otp: values.otp,
          });

          if (response?.data) {
            stashResetPasswordOtp(values.email, values.otp);
            setStatus('success');
            const params = new URLSearchParams({ email: values.email });
            navigateWithTransition({
              router,
              href: withCallbackURL(
                `/reset-password?${params.toString()}`,
                callbackURL
              ) as Route,
              type: 'nav-forward',
            });
            return true;
          }

          setError(response?.error?.message || 'Something went wrong.');
          setStatus('idle');
          return false;
        }
        default: {
          emailType satisfies never;
          throw new Error(`Unhandled type: ${JSON.stringify(emailType)}`);
        }
      }
    })(event);

    if (succeeded) {
      reset();
    }
  };

  const handleResend = async () => {
    if (resendStatus !== 'idle' || cooldown > 0) {
      return;
    }

    const email = getValues('email');
    if (!email) {
      setError('Enter your email address first.');
      return;
    }

    setError(null);
    setResendStatus('loading');

    let response:
      | Awaited<ReturnType<typeof authClient.emailOtp.sendVerificationOtp>>
      | Awaited<ReturnType<typeof authClient.emailOtp.requestPasswordReset>>;

    switch (emailType) {
      case 'email-verification': {
        response = await authClient.emailOtp.sendVerificationOtp({
          email,
          type: 'email-verification',
        });
        break;
      }
      case 'forget-password': {
        response = await authClient.emailOtp.requestPasswordReset({
          email,
        });
        break;
      }
      default: {
        emailType satisfies never;
        throw new Error(`Unhandled type: ${JSON.stringify(emailType)}`);
      }
    }

    if (response?.data) {
      setResendStatus('success');
      setCooldown(60);
      return;
    }

    setError(response?.error?.message || 'Something went wrong');
    setResendStatus('idle');
  };

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
        <FormInputOTP
          control={control}
          name="otp"
          label={copy.otpLabel}
          description="Enter the 6-digit code sent to your email."
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

      <div className="flex flex-col gap-3">
        <StatusButton
          type="submit"
          status={status}
          onStatusChange={setStatus}
          size="lg"
          className="w-full"
          disabled={formState.isSubmitting}
          successLabel={copy.successLabel}
        >
          {copy.submitLabel}
        </StatusButton>
        <StatusButton
          type="button"
          variant="outline"
          className="w-full"
          status={resendStatus}
          onStatusChange={setResendStatus}
          disabled={resendStatus === 'idle' && cooldown > 0}
          successLabel="Code sent"
          onClick={() => void handleResend()}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </StatusButton>
      </div>
    </form>
  );
}
