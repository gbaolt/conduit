import { z } from 'zod';

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const CreateOrganizationInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a workspace name.')
    .max(64, 'Use 64 characters or fewer.'),
  slug: z
    .string()
    .min(3, 'Use at least 3 characters.')
    .max(48, 'Use 48 characters or fewer.')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use lowercase letters, numbers, and single hyphens.'
    ),
});

export const InvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  role: z.string(),
  expiresAt: z.coerce.date(),
});
