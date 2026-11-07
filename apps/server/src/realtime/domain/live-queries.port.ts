export type LiveQueryParameter = string | number | boolean | null | Date;

/** A parameterized SELECT. A `Date` parameter is the UTC wall-clock of a `timestamp` column. */
export type LiveQuery = { sql: string; parameters: LiveQueryParameter[] };

export type SealedQuery = {
  capability: string;
  queryFingerprint: string;
  /** Unix milliseconds. */
  expiresAt: number;
  /** The Realtime WebSocket endpoint that accepts the capability. */
  url: string;
};

/** Turns a query into a short-lived capability a browser can subscribe with. Throws `REALTIME_UNAVAILABLE`. */
export abstract class LiveQueries {
  abstract seal(query: LiveQuery): Promise<SealedQuery>;
}
