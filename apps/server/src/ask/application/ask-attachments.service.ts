import {
  type AskAttachment,
  askAttachmentKind,
  askAttachmentProblem,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { AiAccessService } from '@/ai/application/ai-access.service';
import type { ModelImage } from '@/ai/domain/model.port';
import {
  AskAttachmentsRepository,
  type StoredAskAttachment,
} from '@/ask/domain/ask-attachments.repository';
import { askError } from '@/ask/domain/ask-errors';
import type { AskAttachmentInput } from '@/ask/domain/ask-prompt';
import { fileError } from '@/files/domain/file-errors';
import { safeFileName } from '@/files/domain/file-key';
import type { SearchViewer } from '@/search/application/search.service';
import { FileText } from '@/search/domain/file-text.port';
import { DomainError } from '@/shared/domain/domain-error';
import { ObjectStorage } from '@/storage/domain/object-storage';

/** An upload no question carried in this long is abandoned, and the sweep removes it. */
const UNSENT_TTL_MS = 24 * 60 * 60 * 1000;
const SWEEP_LIMIT = 1000;

/** What a question's attachments give the model: a tag for each, and the pictures to look at. */
export type ReadAttachments = {
  attachments: StoredAskAttachment[];
  inputs: AskAttachmentInput[];
  images: ModelImage[];
};

/**
 * Files the asker attaches to an Ask question. Each belongs to its asker, not to a room, and is read only for
 * the question that carries it.
 */
@Injectable()
export class AskAttachmentsService {
  constructor(
    @Inject(AiAccessService) private readonly access: AiAccessService,
    @Inject(AskAttachmentsRepository)
    private readonly attachments: AskAttachmentsRepository,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
    @Inject(FileText) private readonly fileText: FileText
  ) {}

  async uploadUrl(
    viewer: SearchViewer,
    input: { name: string; contentType: string; size: number }
  ) {
    await this.access.assertEnabled(viewer.organizationId);
    const problem = askAttachmentProblem(input.contentType, input.size);
    if (problem) throw new DomainError('ATTACHMENT_REJECTED', problem);

    const id = crypto.randomUUID();
    const key = `ask/${viewer.organizationId}/${viewer.userId}/${id}/${safeFileName(input.name)}`;
    const { uploadUrl } = await this.storage.presignUpload({
      key,
      contentType: input.contentType,
      size: input.size,
    });
    await this.attachments.create({
      id,
      organizationId: viewer.organizationId,
      ownerId: viewer.userId,
      key,
      name: input.name,
      contentType: input.contentType,
      size: input.size,
    });
    return { attachmentId: id, uploadUrl };
  }

  /** Only the asker finishes an upload, and only once storage holds the promised bytes. */
  async complete(
    viewer: SearchViewer,
    input: { attachmentId: string; width?: number; height?: number }
  ): Promise<AskAttachment> {
    const attachment = await this.attachments.find(input.attachmentId);
    if (
      !attachment ||
      attachment.organizationId !== viewer.organizationId ||
      attachment.ownerId !== viewer.userId
    ) {
      throw askError('ATTACHMENT_NOT_FOUND');
    }
    if (attachment.ready) return this.view(attachment);
    const stored = await this.storage.head(attachment.key);
    if (stored?.size !== attachment.size) throw fileError('UPLOAD_MISSING');
    const image = askAttachmentKind(attachment.contentType) === 'image';
    return this.view(
      await this.attachments.markReady(attachment.id, {
        width: (image && input.width) || null,
        height: (image && input.height) || null,
      })
    );
  }

  /**
   * The asker's unsent attachments with these ids, read for the model. Throws `ATTACHMENT_NOT_FOUND` when one is
   * someone else's, unfinished, or already sent, so a question never reads a file twice or another asker's.
   */
  async read(viewer: SearchViewer, ids: string[]): Promise<ReadAttachments> {
    const unique = [...new Set(ids)];
    const attachments = await this.attachments.unsent(
      viewer.organizationId,
      viewer.userId,
      unique
    );
    if (attachments.length !== unique.length) {
      throw askError('ATTACHMENT_NOT_FOUND');
    }
    const read: ReadAttachments = { attachments, inputs: [], images: [] };
    // In order, so the images reach the model in the order they were attached.
    for (const attachment of attachments) {
      if (askAttachmentKind(attachment.contentType) === 'image') {
        read.inputs.push({ type: 'image', name: attachment.name });
        read.images.push({
          mediaType: attachment.contentType,
          data: await this.storage.read(attachment.key),
        });
      } else {
        read.inputs.push({
          type: 'document',
          name: attachment.name,
          text: await this.fileText.extract(attachment),
        });
      }
    }
    return read;
  }

  /** The attachment as the asker sees it, with a link that shows it in place for 10 minutes. */
  async view(attachment: StoredAskAttachment): Promise<AskAttachment> {
    return {
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      width: attachment.width,
      height: attachment.height,
      url: await this.storage.presignDownload(attachment.key, {
        filename: attachment.name,
        contentType: attachment.contentType,
        inline: true,
      }),
    };
  }

  /** Deletes the objects and rows of attachments no question carries a day after upload. Returns how many. */
  async sweep(now: Date) {
    const sweepable = await this.attachments.sweepable(
      new Date(now.getTime() - UNSENT_TTL_MS),
      SWEEP_LIMIT
    );
    if (sweepable.length === 0) return 0;
    await this.storage.delete(sweepable.map((attachment) => attachment.key));
    await this.attachments.purge(sweepable.map((attachment) => attachment.id));
    return sweepable.length;
  }
}
