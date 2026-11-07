import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { InvitationsRepository } from '@/organizations/domain/invitations.repository';

const stillPending = () => ({
  status: 'pending',
  expiresAt: { gt: new Date() },
});

@Injectable()
export class PrismaInvitationsRepository implements InvitationsRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async listPending(organizationId: string) {
    const rows = await this.db.invitation.findMany({
      where: { organizationId, ...stillPending() },
      include: { user: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role ?? 'member',
      inviterName: row.user.name,
      expiresAt: row.expiresAt,
    }));
  }

  async findPending(invitationId: string) {
    const row = await this.db.invitation.findFirst({
      where: { id: invitationId, ...stillPending() },
      include: { organization: { select: { name: true } } },
    });

    return row
      ? {
          email: row.email,
          organizationName: row.organization.name,
          organizationId: row.organizationId,
        }
      : null;
  }
}
