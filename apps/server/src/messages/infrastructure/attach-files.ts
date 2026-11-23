import type { MessageFile } from '@conduit/contract';
import type { Prisma } from '@generated/prisma/client';

import { messageError } from '@/messages/domain/message-errors';

/**
 * Inside the send transaction, hands each file to the message and returns what the message keeps about them,
 * in the order sent. Every file must be ready, the author's own, uploaded to this room, and carried by no other
 * message, or the whole send rolls back with `FILE_UNAVAILABLE`.
 */
export async function attachFiles(
  tx: Prisma.TransactionClient,
  input: {
    fileIds: string[];
    messageId: string;
    roomId: string;
    authorId: string;
  }
): Promise<MessageFile[]> {
  if (input.fileIds.length === 0) return [];

  const { count } = await tx.file.updateMany({
    where: {
      id: { in: input.fileIds },
      roomId: input.roomId,
      uploaderId: input.authorId,
      messageId: null,
      status: 'READY',
      deletedAt: null,
    },
    data: { messageId: input.messageId },
  });
  if (count !== input.fileIds.length) {
    throw messageError('FILE_UNAVAILABLE');
  }

  const rows = await tx.file.findMany({ where: { id: { in: input.fileIds } } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return input.fileIds.map((id) => {
    const row = byId.get(id)!;
    return {
      id: row.id,
      name: row.name,
      contentType: row.contentType,
      size: row.size,
      width: row.width,
      height: row.height,
    };
  });
}
