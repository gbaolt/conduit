/** One filter typed into the search field. `raw` is the token as typed, so removing a chip removes exactly it. */
export type SearchFilter = { raw: string } & (
  | { key: 'in'; target: 'channel' | 'person'; name: string }
  | { key: 'from'; name: string }
  | { key: 'has'; value: 'file' }
  | { key: 'before' | 'after'; date: string }
);

export type ParsedSearch = {
  /** Words to rank by, quotes removed. Empty when the query is filters alone. */
  terms: string[];
  filters: SearchFilter[];
};

// A run of plain characters and quoted stretches, so `from:@"Linh Pham"` is one token. A quote left open runs to the end.
const TOKEN = /(?:[^\s"]+|"[^"]*"?)+/g;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const unquote = (text: string) => text.replace(/"/g, '');

function isDate(text: string) {
  if (!DATE.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

function parseFilter(raw: string): SearchFilter | null {
  const colon = raw.indexOf(':');
  if (colon < 1) return null;
  const key = raw.slice(0, colon).toLowerCase();
  const value = raw.slice(colon + 1);
  const name = unquote(value.slice(1)).trim();

  if (key === 'in' && (value[0] === '#' || value[0] === '@') && name) {
    return {
      raw,
      key,
      target: value[0] === '#' ? 'channel' : 'person',
      name,
    };
  }
  if (key === 'from' && value[0] === '@' && name) {
    return { raw, key, name };
  }
  if (key === 'has' && value.toLowerCase() === 'file') {
    return { raw, key, value: 'file' };
  }
  if ((key === 'before' || key === 'after') && isDate(value)) {
    return { raw, key, date: value };
  }
  return null;
}

/**
 * Reads `in:#channel`, `in:@person`, `from:@person`, `has:file`, `before:YYYY-MM-DD`, and `after:YYYY-MM-DD`,
 * in any order and any case. Anything else, a malformed filter included, is a term, so typing never throws.
 */
export function parseSearchQuery(text: string): ParsedSearch {
  const terms: string[] = [];
  const filters: SearchFilter[] = [];
  for (const raw of text.match(TOKEN) ?? []) {
    const filter = parseFilter(raw);
    if (filter) filters.push(filter);
    else {
      const term = unquote(raw).trim();
      if (term) terms.push(term);
    }
  }
  return { terms, filters };
}

/** The query with one filter taken out, spacing tidied. */
export function withoutFilter(text: string, filter: SearchFilter) {
  const tokens: string[] = text.match(TOKEN) ?? [];
  const at = tokens.indexOf(filter.raw);
  if (at === -1) return text;
  tokens.splice(at, 1);
  return tokens.join(' ');
}

/** The UTC instant a calendar day starts in `timeZone`, for `before:` and `after:`. */
export function startOfDayIn(date: string, timeZone: string) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day);
  const offset = (at: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(at);
    const part = (type: string) =>
      Number(parts.find((entry) => entry.type === type)?.value);
    const local = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second')
    );
    return local - at;
  };
  // A second pass corrects for a day whose offset differs from the first guess's, as on a DST change.
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}
