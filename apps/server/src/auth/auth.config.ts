import crypto from 'node:crypto';

import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP, organization } from 'better-auth/plugins';

import { prisma } from '@/database/prisma.service';

import { resend } from './resend';
import { getTrustedOrigins } from './trusted-origins';
import { PasswordSchema } from './validations';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getCookieAdvanced(baseURL: string) {
  const domain = process.env.AUTH_COOKIE_DOMAIN;

  return {
    useSecureCookies: baseURL.startsWith('https://'),
    crossSubDomainCookies:
      domain && !domain.includes(':')
        ? { enabled: true as const, domain }
        : { enabled: false as const },
  };
}

const passwordHooks: BetterAuthOptions['hooks'] = {
  before: createAuthMiddleware(async (ctx) => {
    if (
      ctx.path === '/sign-up/email' ||
      ctx.path === '/reset-password' ||
      ctx.path === '/change-password'
    ) {
      const password = ctx.body.password || ctx.body.newPassword;

      const { error } = PasswordSchema.safeParse(password);

      if (error) {
        throw new APIError('BAD_REQUEST', {
          message: 'Password not strong enough.',
        });
      }
    }
  }),
};

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3333';
const appURL = process.env.APP_URL ?? 'https://app.conduit.localhost';
const emailFrom = `Gia Bảo from Conduit <${process.env.AUTH_EMAIL_FROM ?? 'conduit@giabao.dev'}>`;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: requireEnv('BETTER_AUTH_SECRET'),
  baseURL,
  basePath: '/auth',
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const emailPrefix = user.email.split('@')[0];
          const generatedName = emailPrefix
            ?.split(/[._-]/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

          const emailHash = crypto
            .createHash('sha256')
            .update(user.email.trim().toLowerCase())
            .digest('hex');
          const generatedImage = `https://gravatar.com/avatar/${emailHash}?d=retro`;

          return {
            data: {
              ...user,
              name: user.name || generatedName,
              image: user.image || generatedImage,
              role: user.role || 'user',
            },
          };
        },
      },
    },
  },
  hooks: passwordHooks,
  advanced: getCookieAdvanced(baseURL),
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      otpLength: 6,
      async sendVerificationOTP({ email, otp, type }) {
        const OtpSubjects: Record<string, string> = {
          'sign-in': 'Your sign-in code',
          'email-verification': 'Verify your email',
          'forget-password': 'Reset your password',
          'change-email': 'Verify your new email',
        };

        const subject = OtpSubjects[type] || 'Your verification code';

        if (!resend) {
          console.log(`[auth:otp] to=${email} type=${type} otp=${otp}`);
          return;
        }

        await resend.emails.send({
          from: emailFrom,
          to: [email],
          subject,
          html: `<p>Your OTP code is: <strong>${otp}</strong></p>`,
        });
      },
    }),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      async sendInvitationEmail(data) {
        const inviteLink = `${appURL}/accept-invitation?id=${data.id}`;

        if (!resend) {
          console.log(
            `[auth:invite] to=${data.email} org=${data.organization.name} link=${inviteLink}`
          );
          return;
        }

        await resend.emails.send({
          from: emailFrom,
          to: [data.email],
          subject: `Join the ${data.organization.name} workspace on Conduit`,
          html: `<p>${data.inviter.user.name} invited you to join ${data.organization.name}.</p><p><a href="${inviteLink}">Accept invitation</a></p>`,
        });
      },
    }),
  ],
});

export type Auth = typeof auth;
export type Session = Auth['$Infer']['Session'];
export type User = Session['user'];
