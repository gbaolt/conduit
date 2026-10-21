import { z } from 'zod';

const DateTimeSchema = z.coerce.date();

export const SessionOutputSchema = z
  .object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      emailVerified: z.boolean(),
      image: z.string().nullable().optional(),
      createdAt: DateTimeSchema,
      updatedAt: DateTimeSchema,
    }),
    session: z.object({
      id: z.string(),
      token: z.string(),
      userId: z.string(),
      expiresAt: DateTimeSchema,
      createdAt: DateTimeSchema,
      updatedAt: DateTimeSchema,
      ipAddress: z.string().nullable().optional(),
      userAgent: z.string().nullable().optional(),
      activeOrganizationId: z.string().nullable().optional(),
    }),
  })
  .nullable();
