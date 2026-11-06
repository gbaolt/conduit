import { z } from 'zod';

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

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
export type CreateOrganizationInput = z.infer<
  typeof CreateOrganizationInputSchema
>;

export const UpdateOrganizationInputSchema =
  CreateOrganizationInputSchema.partial();
export type UpdateOrganizationInput = z.infer<
  typeof UpdateOrganizationInputSchema
>;

export const InvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  role: z.string(),
  expiresAt: z.coerce.date(),
});
export type Invitation = z.infer<typeof InvitationSchema>;

export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'member']);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const WorkspaceMemberStatusSchema = z.enum(['active', 'deactivated']);
export type WorkspaceMemberStatus = z.infer<typeof WorkspaceMemberStatusSchema>;

export const WorkspaceMemberSchema = z.object({
  memberId: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: WorkspaceRoleSchema,
  status: WorkspaceMemberStatusSchema,
  joinedAt: z.coerce.date(),
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const MemberIdInputSchema = z.object({ memberId: z.string() });

export const UpdateMemberRoleInputSchema = z.object({
  memberId: z.string(),
  role: WorkspaceRoleSchema,
});

export const InviteRoleSchema = z.enum(['member', 'admin']);

export const CreateInvitationsInputSchema = z.object({
  emails: z
    .array(z.email('Enter a valid email address.'))
    .min(1, 'Enter at least one email.')
    .max(20, 'Invite up to 20 people at a time.'),
  role: InviteRoleSchema,
});

export const CreateInvitationsResultSchema = z.object({
  sent: z.array(z.string()),
  skipped: z.array(
    z.object({ email: z.string(), reason: z.enum(['member', 'invited']) })
  ),
});
export type CreateInvitationsResult = z.infer<
  typeof CreateInvitationsResultSchema
>;

export const WorkspaceInvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  inviterName: z.string(),
  expiresAt: z.coerce.date(),
});
export type WorkspaceInvitation = z.infer<typeof WorkspaceInvitationSchema>;

export const InvitationIdInputSchema = z.object({ invitationId: z.string() });

/** What the email link shows before the visitor accepts. */
export const InvitationPreviewSchema = z.object({
  email: z.string(),
  organizationName: z.string(),
});
export type InvitationPreview = z.infer<typeof InvitationPreviewSchema>;
export type InviteRole = z.infer<typeof InviteRoleSchema>;

export const JoinLinkSchema = z.object({ token: z.string() });

export const JoinLinkTokenInputSchema = z.object({ token: z.string().min(1) });

/** What the join page shows before the visitor signs in. Nothing about members. */
export const JoinLinkPreviewSchema = z.object({
  organizationName: z.string(),
  logo: z.string().nullable(),
});

export const JoinedWorkspaceSchema = z.object({ organizationId: z.string() });

export const DomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    'Enter a domain such as acme.dev.'
  );

export const AllowedDomainsInputSchema = z.object({
  domains: z.array(DomainSchema).max(20, 'Add up to 20 domains.'),
});

export const AllowedDomainsSchema = z.array(z.string());

export const OrganizationIdInputSchema = z.object({
  organizationId: z.string(),
});

/** A workspace the caller may join because their email domain is allowed. */
export const JoinableWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().nullable(),
});
export type JoinableWorkspace = z.infer<typeof JoinableWorkspaceSchema>;
