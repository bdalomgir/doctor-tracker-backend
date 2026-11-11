/**
 * Index-friendly search helpers.
 *
 * Every searchable document stores a `searchTokens` array: the lower-cased
 * words of its searchable fields. The array has a (multikey) index, and the
 * query uses *anchored, case-sensitive* regexes (`/^term/`) against it.
 * MongoDB can turn an anchored, case-sensitive regex into a bounded index range
 * scan, so "search as you type" stays fast without scanning the collection
 * (an unanchored `/term/i` regex would force a full scan).
 */

const MAX_TERMS = 5;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Splits free text into unique lower-case word tokens. */
export function tokenize(...values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const text = normalise(value);
    // Keep the whole value too (e.g. full e-mail "john@x.com", phone "+880171...").
    tokens.add(text.trim());
    for (const word of text.split(/[^a-z0-9]+/)) {
      if (word) tokens.add(word);
    }

    // Phone numbers: digits only, plus the local form without the BD country
    // code, so "+880 1711-000000" is found by "01711" as well as "88017".
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length === text.replace(/[\s\-()+]/g, '').length) {
      tokens.add(digits);
      if (digits.startsWith('880')) tokens.add(digits.slice(2));
    }
  }

  return [...tokens].filter(Boolean);
}

/**
 * Builds a filter where every term in the query must prefix-match one token,
 * e.g. "john sm" matches a doctor named "John Smith".
 */
export function buildSearchFilter(search?: string): Record<string, unknown> {
  if (!search?.trim()) return {};

  const terms = normalise(search).split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);

  if (terms.length === 0) return {};

  return {
    searchTokens: { $all: terms.map((term) => new RegExp(`^${escapeRegex(term)}`)) },
  };
}

/** Schema transform: keeps the internal search index out of API responses. */
export function hideInternalFields(_doc: unknown, ret: Record<string, unknown>) {
  delete ret.searchTokens;
  return ret;
}
