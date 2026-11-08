import type {
  ActivityRepository,
  ConversationScope,
} from '@/activity/domain/activity.repository';

const keyOf = ({ roomId, userId, parentId }: ConversationScope) =>
  `${roomId}|${userId}|${parentId}`;

/** An in-memory `ActivityRepository` for tests and the write-rate script. `counts` tallies the calls that would write. */
export class InMemoryActivityRepository implements ActivityRepository {
  readonly counts = {
    markRead: 0,
    saveDraft: 0,
    setTyping: 0,
    recordHeartbeat: 0,
  };
  readonly reads = new Map<string, { at: Date; messageId: string }>();
  readonly drafts = new Map<string, string>();
  readonly typing = new Map<string, Date>();
  readonly presence = new Map<string, { at: Date; away: boolean }>();

  /** `messages` maps a message id to its channel and time, standing in for the Message table. */
  constructor(
    private readonly messages: ReadonlyMap<
      string,
      { roomId: string; createdAt: Date }
    > = new Map()
  ) {}

  get writes() {
    return Object.values(this.counts).reduce((sum, count) => sum + count, 0);
  }

  // shortcut: counts one write per call, while the Prisma version needs two statements the first time a row is created
  async markRead(input: { roomId: string; userId: string; messageId: string }) {
    const message = this.messages.get(input.messageId);
    if (message?.roomId !== input.roomId) return false;

    this.counts.markRead++;
    const key = `${input.roomId}|${input.userId}`;
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
    this.counts.saveDraft++;
    if (body === '') this.drafts.delete(keyOf(scope));
    else this.drafts.set(keyOf(scope), body);
  }

  async setTyping(scope: ConversationScope, until: Date) {
    this.counts.setTyping++;
    this.typing.set(keyOf(scope), until);
  }

  async recordHeartbeat(input: {
    organizationId: string;
    userId: string;
    away: boolean;
    at: Date;
  }) {
    this.counts.recordHeartbeat++;
    this.presence.set(`${input.organizationId}|${input.userId}`, {
      at: input.at,
      away: input.away,
    });
  }
}
