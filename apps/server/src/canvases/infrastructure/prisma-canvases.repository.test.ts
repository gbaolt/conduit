import { expect, it, vi } from 'vitest';

import type { PrismaService } from '@/infrastructure/database/prisma.service';

import { PrismaCanvasesRepository } from './prisma-canvases.repository';

it('looks up names only for active members of the requested workspace', async () => {
  const findMany = vi.fn().mockResolvedValue([{ id: 'member', name: 'Bao' }]);
  const db = { user: { findMany } } as unknown as PrismaService;
  const repository = new PrismaCanvasesRepository(db);
  const ids = ['member', 'outside', 'deactivated'];

  await expect(repository.workspaceUserNames('org', ids)).resolves.toEqual(
    new Map([['member', 'Bao']])
  );
  expect(findMany).toHaveBeenCalledExactlyOnceWith({
    where: {
      id: { in: ids },
      members: { some: { organizationId: 'org', deactivation: null } },
    },
    select: { id: true, name: true },
  });
});
