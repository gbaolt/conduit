import {
  parseSearchQuery,
  SEARCH_LIMIT_DEFAULT,
  type SearchFilter,
  type SearchInput,
  type SearchOutput,
  startOfDayIn,
} from '@conduit/contract';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { NotificationSettingsService } from '@/notifications/application/notification-settings.service';
import { RoomsRepository } from '@/rooms/domain/rooms.repository';
import {
  SearchRepository,
  type SearchScope,
} from '@/search/domain/search.repository';
import { SearchIndex } from '@/search/domain/search-index.port';
import type { WorkspaceViewer } from '@/workspaces/domain/workspace-viewer';

export type SearchViewer = WorkspaceViewer;

/** How many index hits to read per result shown, since hydration drops hits the caller can't see. */
const OVERFETCH = 3;

const quoted = (ids: string[]) =>
  ids.map((id) => `'${id.replace(/['\\]/g, '')}'`).join(', ');

/** Upstash's filter for the scope, on the metadata `searchDoc` writes. */
function indexFilter(kind: 'message' | 'file', scope: SearchScope) {
  return [
    `kind = '${kind}'`,
    `roomId IN (${quoted(scope.roomIds)})`,
    scope.authorIds.length > 0 && `authorId IN (${quoted(scope.authorIds)})`,
    scope.hasFile && 'hasFile = 1',
    scope.from && `createdAt >= ${scope.from.getTime()}`,
    scope.until && `createdAt < ${scope.until.getTime()}`,
  ]
    .filter(Boolean)
    .join(' AND ');
}

/** The id each document stands for, best first, once each: `message:<id>`, or `file:<id>:<chunk>`. */
function targetIds(hits: { id: string }[]) {
  return [...new Set(hits.map((hit) => hit.id.split(':')[1]!))];
}

const ofKey = <K extends SearchFilter['key']>(
  filters: SearchFilter[],
  key: K
) =>
  filters.filter(
    (filter): filter is SearchFilter & { key: K } => filter.key === key
  );

/**
 * The index suggests and Postgres decides. Every message and file the index returns is read back from
 * Postgres inside the rooms the caller can read now, so a deleted message, an edit, or a room just left
 * never shows, however far the index has fallen behind.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(SearchRepository) private readonly search: SearchRepository,
    @Inject(SearchIndex) private readonly index: SearchIndex,
    @Inject(RoomsRepository) private readonly rooms: RoomsRepository,
    @Inject(NotificationSettingsService)
    private readonly settings: NotificationSettingsService
  ) {}

  async query(viewer: SearchViewer, input: SearchInput): Promise<SearchOutput> {
    const limit = input.limit ?? SEARCH_LIMIT_DEFAULT;
    const { terms, filters } = parseSearchQuery(input.text);
    const text = terms.join(' ');
    const result: SearchOutput = {
      messages: [],
      files: [],
      channels: [],
      people: [],
      indexed: true,
    };
    if (!text && filters.length === 0) return result;

    const readable = await this.rooms.accessibleRoomIds(viewer);
    const [scope, channels, people] = await Promise.all([
      this.scope(viewer, readable, filters),
      text
        ? this.search.channels(
            viewer.organizationId,
            viewer.userId,
            readable,
            text,
            limit
          )
        : [],
      text ? this.search.people(viewer.organizationId, text, limit) : [],
    ]);
    result.channels = channels;
    result.people = people;
    if (!scope) return result;

    if (!text) {
      [result.messages, result.files] = await Promise.all([
        this.search.recentMessages(scope, limit),
        this.search.recentFiles(scope, limit),
      ]);
      return result;
    }

    try {
      const [messageHits, fileHits] = await Promise.all(
        (['message', 'file'] as const).map((kind) =>
          this.index.query(viewer.organizationId, {
            text,
            filter: indexFilter(kind, scope),
            topK: limit * OVERFETCH,
            mode: 'hybrid',
          })
        )
      );
      const [messages, files] = await Promise.all([
        this.search.messages(scope, targetIds(messageHits!)),
        this.search.files(scope, targetIds(fileHits!)),
      ]);
      result.messages = messages.slice(0, limit);
      result.files = files.slice(0, limit);
    } catch (error) {
      this.logger.warn(
        `Search index query failed: ${error instanceof Error ? error.message : String(error)}`
      );
      result.indexed = false;
    }
    return result;
  }

  /** The filters as ids and times, or null when a filter names nothing the caller can read. */
  private async scope(
    viewer: SearchViewer,
    readable: string[],
    filters: SearchFilter[]
  ): Promise<SearchScope | null> {
    const ins = ofKey(filters, 'in');
    const froms = ofKey(filters, 'from');
    const afters = ofKey(filters, 'after').map((filter) => filter.date);
    const befores = ofKey(filters, 'before').map((filter) => filter.date);
    const channelNames = ins
      .filter((filter) => filter.target === 'channel')
      .map((filter) => filter.name);
    const personNames = ins
      .filter((filter) => filter.target === 'person')
      .map((filter) => filter.name);
    const { organizationId, userId } = viewer;

    const [channelIds, dmIds, authorIds, timeZone] = await Promise.all([
      channelNames.length > 0
        ? this.search.channelIdsNamed(organizationId, channelNames)
        : [],
      personNames.length > 0
        ? this.search
            .userIdsNamed(organizationId, personNames)
            .then((ids) => this.search.dmIdsWith(organizationId, userId, ids))
        : [],
      froms.length > 0
        ? this.search.userIdsNamed(
            organizationId,
            froms.map((filter) => filter.name)
          )
        : [],
      afters.length > 0 || befores.length > 0
        ? this.settings.get(viewer).then((settings) => settings.timeZone)
        : 'UTC',
    ]);

    const named = new Set([...channelIds, ...dmIds]);
    const roomIds =
      ins.length > 0 ? readable.filter((id) => named.has(id)) : readable;
    if (roomIds.length === 0 || (froms.length > 0 && authorIds.length === 0)) {
      return null;
    }

    // Repeats narrow: the latest `after:` and the earliest `before:` win.
    const after = afters.sort().at(-1);
    const before = befores.sort()[0];
    return {
      organizationId,
      roomIds,
      authorIds,
      hasFile: filters.some((filter) => filter.key === 'has'),
      ...(after && { from: startOfDayIn(after, timeZone) }),
      ...(before && { until: startOfDayIn(before, timeZone) }),
    };
  }
}
