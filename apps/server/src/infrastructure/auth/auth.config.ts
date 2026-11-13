import crypto from 'node:crypto';

import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP, organization } from 'better-auth/plugins';

import { WorkspaceMembershipService } from '@/channels/application/workspace-membership.service';
import { PrismaWorkspaceMembershipRepository } from '@/channels/infrastructure/prisma-workspace-membership.repository';
import { prisma } from '@/infrastructure/database/prisma.service';
import { isWorker } from '@/infrastructure/runtime';
import { PrismaWorkspaceMembersRepository } from '@/workspaces/infrastructure/prisma-workspace-members.repository';

import { refuseDeactivatedMember } from './deactivated-guard';
import { PasswordSchema } from './password-policy';
import { appURL, emailFrom, resend } from './resend';
import { getTrustedOrigins } from './trusted-origins';

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
    // Cloudflare sets cf-connecting-ip itself; elsewhere a client could forge it.
    ipAddress: {
      ipAddressHeaders: isWorker ? ['cf-connecting-ip'] : ['x-forwarded-for'],
    },
    crossSubDomainCookies:
      domain && !domain.includes(':')
        ? { enabled: true as const, domain }
        : { enabled: false as const },
  };
}

// Built by hand for the same reason as `workspaceMembership` below.
const refuseDeactivated = refuseDeactivatedMember(
  new PrismaWorkspaceMembersRepository(prisma)
);

const authHooks: BetterAuthOptions['hooks'] = {
  before: createAuthMiddleware(async (ctx) => {
    await refuseDeactivated(ctx);

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

// Better Auth is built at import time, outside Nest DI, so its hooks get their use case here.
const workspaceMembership = new WorkspaceMembershipService(
  new PrismaWorkspaceMembershipRepository(prisma)
);

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3333';

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
  hooks: authHooks,
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
      // Better Auth also calls afterAddMember for the creator inside createOrganization, so that path is covered too.
      organizationHooks: {
        afterAddMember: ({ organization, member }) =>
          workspaceMembership.memberJoined(organization, member.userId),
        afterAcceptInvitation: ({ organization, member }) =>
          workspaceMembership.memberJoined(organization, member.userId),
        afterRemoveMember: ({ organization, member }) =>
          workspaceMembership.memberRemoved(organization.id, member.userId),
      },
    }),
  ],
});

export type Auth = typeof auth;
export type Session = Auth['$Infer']['Session'];
export type User = Session['user'];
