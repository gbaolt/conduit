import type { Invitation } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import type { InvitationsRepository } from '@/organizations/domain/invitations.repository';
import type { JoinAccessRepository } from '@/organizations/domain/join-access.repository';
import type { OrganizationsGateway } from '@/organizations/domain/organizations.gateway';
import { fakeStorage } from '@/storage/testing/fake-object-storage';
import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

import { OrganizationsService } from './organizations.service';

const invitation = (id: string, expiresAt: Date): Invitation => ({
  id,
  organizationId: 'org',
  organizationName: 'Acme',
  role: 'member',
  expiresAt,
});

describe('OrganizationsService.listInvitations', () => {
  it('hides invitations that have expired', async () => {
    const hour = 60 * 60 * 1000;
    const gateway = {
      listInvitations: async () => [
        invitation('live', new Date(Date.now() + hour)),
        invitation('expired', new Date(Date.now() - hour)),
      ],
    } as Partial<OrganizationsGateway> as OrganizationsGateway;

    const invitations = await new OrganizationsService(
      gateway,
      {} as WorkspaceMembersRepository,
      {} as InvitationsRepository,
      {} as JoinAccessRepository,
      fakeStorage
    ).listInvitations(new Headers());

    expect(invitations.map((i) => i.id)).toEqual(['live']);
  });
});
