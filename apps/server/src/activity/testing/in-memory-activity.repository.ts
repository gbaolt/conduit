import type {
  ActivityRepository,
  ConversationScope,
} from '@/activity/domain/activity.repository';

const keyOf = ({ channelId, userId, parentId }: ConversationScope) =>
  `${channelId}|${userId}|${parentId}`;

/** An in-memory `ActivityRepository` for tests and the write-rate script. `writes` counts calls that reach the database. */
export class InMemoryActivityRepository implements ActivityRepository {
  writes = 0;
  readonly reads = new Map<string, { at: Date; messageId: string }>();
  readonly drafts = new Map<string, string>();
  readonly typing = new Map<string, Date>();
  readonly presence = new Map<string, { at: Date; away: boolean }>();

  /** `messages` maps a message id to its channel and time, standing in for the Message table. */
  constructor(
    private readonly messages: ReadonlyMap<
      string,
      { channelId: string; createdAt: Date }
    > = new Map()
  ) {}

  // shortcut: counts one write per call, while the Prisma version needs two statements the first time a row is created
  async markRead(input: {
    channelId: string;
    userId: string;
    messageId: string;
  }) {
    const message = this.messages.get(input.messageId);
    if (message?.channelId !== input.channelId) return false;

    this.writes++;
    const key = `${input.channelId}|${input.userId}`;
    const current = this.reads.get(key);
    if (!current || current.at < message.createdAt) {
      this.reads.set(key, {
        at: message.createdAt,
        messageId: input.messageId,
      });
    }
    return true;
  }

  async getDraft(scope: ConversationScope) {
    return this.drafts.get(keyOf(scope)) ?? '';
  }

  async saveDraft(scope: ConversationScope, body: string) {
    this.writes++;
    if (body === '') this.drafts.delete(keyOf(scope));
    else this.drafts.set(keyOf(scope), body);
  }

  async setTyping(scope: ConversationScope, until: Date) {
    this.writes++;
    this.typing.set(keyOf(scope), until);
  }

  async recordHeartbeat(input: {
    organizationId: string;
    userId: string;
    away: boolean;
    at: Date;
  }) {
    this.writes++;
    this.presence.set(`${input.organizationId}|${input.userId}`, {
      at: input.at,
      away: input.away,
    });
  }
}
