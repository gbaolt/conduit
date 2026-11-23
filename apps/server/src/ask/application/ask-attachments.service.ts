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
import { FilesService } from '@/files/application/files.service';
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
    @Inject(FileText) private readonly fileText: FileText,
    @Inject(FilesService) private readonly files: FilesService
  ) {}

  /**
   * Where each attachment's bytes live now, by id. An upload's own object always. A picked file's object only
   * while the asker can still open it in a channel, so access is checked on every read.
   */
  private async keys(
    viewer: SearchViewer,
    attachments: readonly StoredAskAttachment[]
  ) {
    const fileIds = attachments.flatMap((a) => (a.fileId ? [a.fileId] : []));
    const files =
      fileIds.length > 0 ? await this.files.channelFiles(viewer, fileIds) : [];
    const fileKeys = new Map(files.map((file) => [file.id, file.key]));
    return new Map(
      attachments.map((attachment) => [
        attachment.id,
        attachment.fileId
          ? (fileKeys.get(attachment.fileId) ?? null)
          : attachment.key,
      ])
    );
  }

  /**
   * Attaches a sent file from a channel the asker can read, without a copy. A DM's file, a file the asker can't
   * read, and a gone file all read as missing.
   */
  async attachFile(viewer: SearchViewer, fileId: string) {
    await this.access.assertEnabled(viewer.organizationId);
    const [file] = await this.files.channelFiles(viewer, [fileId]);
    if (!file) throw askError('ATTACHMENT_NOT_FOUND');
    const problem = askAttachmentProblem(file.contentType, file.size);
    if (problem) throw new DomainError('ATTACHMENT_REJECTED', problem);

    const id = crypto.randomUUID();
    await this.attachments.create({
      id,
      organizationId: viewer.organizationId,
      ownerId: viewer.userId,
      fileId: file.id,
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      width: file.width,
      height: file.height,
      ready: true,
    });
    const [view] = await this.views(viewer, [
      (await this.attachments.find(id))!,
    ]);
    return view!;
  }

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
    if (!attachment.key) throw askError('ATTACHMENT_NOT_FOUND');
    if (!attachment.ready) {
      const stored = await this.storage.head(attachment.key);
      if (stored?.size !== attachment.size) throw fileError('UPLOAD_MISSING');
    }
    const image = askAttachmentKind(attachment.contentType) === 'image';
    const ready = attachment.ready
      ? attachment
      : await this.attachments.markReady(attachment.id, {
          width: (image && input.width) || null,
          height: (image && input.height) || null,
        });
    const [view] = await this.views(viewer, [ready]);
    return view!;
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
    const keys = await this.keys(viewer, attachments);
    if (
      attachments.length !== unique.length ||
      attachments.some((attachment) => !keys.get(attachment.id))
    ) {
      throw askError('ATTACHMENT_NOT_FOUND');
    }
    const read: ReadAttachments = { attachments, inputs: [], images: [] };
    // In order, so the images reach the model in the order they were attached.
    for (const attachment of attachments) {
      const key = keys.get(attachment.id)!;
      if (askAttachmentKind(attachment.contentType) === 'image') {
        read.inputs.push({ type: 'image', name: attachment.name });
        read.images.push({
          mediaType: attachment.contentType,
          data: await this.storage.read(key),
        });
      } else {
        read.inputs.push({
          type: 'document',
          name: attachment.name,
          text: await this.fileText.extract({ ...attachment, key }),
        });
      }
    }
    return read;
  }

  /**
   * The attachments as the asker sees them, each with a link that shows it in place for 10 minutes. A picked
   * file the asker can no longer open reads as unavailable, with no link.
   */
  async views(
    viewer: SearchViewer,
    attachments: readonly StoredAskAttachment[]
  ): Promise<AskAttachment[]> {
    const keys = await this.keys(viewer, attachments);
    return Promise.all(
      attachments.map(async (attachment) => {
        const key = keys.get(attachment.id);
        return {
          id: attachment.id,
          name: attachment.name,
          contentType: attachment.contentType,
          size: attachment.size,
          width: attachment.width,
          height: attachment.height,
          available: Boolean(key),
          url: key
            ? await this.storage.presignDownload(key, {
                filename: attachment.name,
                contentType: attachment.contentType,
                inline: true,
              })
            : null,
        };
      })
    );
  }

  /** Deletes the objects and rows of attachments no question carries a day after upload. Returns how many. */
  async sweep(now: Date) {
    const sweepable = await this.attachments.sweepable(
      new Date(now.getTime() - UNSENT_TTL_MS),
      SWEEP_LIMIT
    );
    if (sweepable.length === 0) return 0;
    // A picked file has no object of its own, so only its row goes.
    await this.storage.delete(
      sweepable.flatMap((attachment) => attachment.key ?? [])
    );
    await this.attachments.purge(sweepable.map((attachment) => attachment.id));
    return sweepable.length;
  }
}
