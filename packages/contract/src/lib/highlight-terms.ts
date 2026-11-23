const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` cut into runs, each marked where it matches a term, case aside. Longer terms win where two overlap. */
export function highlightTerms(text: string, terms: readonly string[]) {
  const words = [...new Set(terms.map((term) => term.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escape);
  if (words.length === 0 || !text) return [{ text, match: false }];

  const runs: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const found of text.matchAll(new RegExp(words.join('|'), 'gi'))) {
    if (found.index > last) {
      runs.push({ text: text.slice(last, found.index), match: false });
    }
    runs.push({ text: found[0], match: true });
    last = found.index + found[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), match: false });
  return runs;
}
