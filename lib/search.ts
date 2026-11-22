/**
 * Product search (BUN-172). Runs on the storefront over the cached list of
 * visible products, so only products shown online can ever be found, and it
 * answers in milliseconds (suggestions while typing).
 *
 * Matching, per word typed (every word must match something):
 * - whole word ("fish" → "Fish bun"),
 * - start of a word ("choc" → "Chocolate cake"), so partial words work,
 * - small typos: one wrong, missing, extra or swapped letter for words of
 *   4–7 letters, two for longer words ("chocolat", "sausge", "birthdy").
 * The name counts most, then item code and category, then the description.
 */

/** "Crème Brûlée!" → "creme brulee". */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const words = (text: string) => normalize(text).split(" ").filter(Boolean);

/** Typos allowed for a word of this length. */
function allowedTypos(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

/**
 * Edit distance with adjacent swaps (optimal string alignment), stopping early
 * once it is over `max`. Returns max + 1 when it is over.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

/** How well one typed word matches one word of the text: 3 exact, 2 start of word, 1 typo, 0 none. */
function wordScore(typed: string, word: string): number {
  if (word === typed) return 3;
  if (word.startsWith(typed)) return 2;
  const max = allowedTypos(typed.length);
  if (max === 0) return 0;
  // Compare with the whole word, and with its start (a typo in a partial word: "chocl" → "chocolate").
  if (editDistance(typed, word, max) <= max) return 1;
  if (word.length > typed.length && editDistance(typed, word.slice(0, typed.length), max) <= max) {
    return 1;
  }
  return 0;
}

/** Best match of each typed word in a text; 0 when any typed word matches nothing. */
function fieldScore(typed: string[], text: string | undefined): number {
  if (!text) return 0;
  const textWords = words(text);
  let total = 0;
  for (const t of typed) {
    const best = Math.max(0, ...textWords.map((w) => wordScore(t, w)));
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export type Searchable = {
  slug: string;
  name: string;
  description: string;
  code?: string;
  categorySlug: string;
  featured: boolean;
  popularity?: number;
};

/**
 * Score for one product, 0 when it doesn't match. Every typed word must match
 * in the same field: the name, the code, the category name or the
 * description (the description only on whole words or word starts, so long
 * descriptions don't match by accident).
 */
export function scoreProduct(
  typed: string[],
  product: Searchable,
  categoryName: string | undefined,
): number {
  const nameScore = fieldScore(typed, product.name);
  // The whole name typed beats a longer name that contains it.
  const name =
    (nameScore + (nameScore > 0 && normalize(product.name) === typed.join(" ") ? 1 : 0)) * 4;
  // Item code: the whole query must be the code ("MK-001", "mk 001").
  const code = product.code && normalize(product.code) === typed.join(" ") ? 12 : 0;
  const category = fieldScore(typed, categoryName) * 1.5;
  const description = typed.every((t) => words(product.description).some((w) => w.startsWith(t)))
    ? typed.length
    : 0;
  return Math.max(name, code, category, description);
}

/**
 * Products matching the query, best first: score, then featured, then
 * popularity, then the original (ERP) order.
 */
export function searchCatalog<P extends Searchable>(
  products: P[],
  query: string,
  categoryNames: Map<string, string> = new Map(),
): P[] {
  const typed = words(query);
  if (typed.length === 0) return [];
  return products
    .map((product, i) => ({
      product,
      i,
      score: scoreProduct(typed, product, categoryNames.get(product.categorySlug)),
    }))
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.product.featured) - Number(a.product.featured) ||
        (b.product.popularity ?? 0) - (a.product.popularity ?? 0) ||
        a.i - b.i,
    )
    .map((r) => r.product);
}

/** Categories whose name matches the query, best first (ERP order on ties). */
export function searchCategories<C extends { name: string }>(categories: C[], query: string): C[] {
  const typed = words(query);
  if (typed.length === 0) return [];
  return categories
    .map((category, i) => {
      const score = fieldScore(typed, category.name);
      // The whole name typed ("cakes" → "Cakes") beats a name that only contains it.
      const exact = score > 0 && normalize(category.name) === typed.join(" ") ? 1 : 0;
      return { category, i, score: score + exact };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.category);
}

/** The query as stored for "no result" tracking: normalised, at most 100 characters. */
export function searchKey(query: string): string {
  return normalize(query).slice(0, 100);
}

/** Answer of GET /api/search/suggest (type-ahead in the search box). */
export type SearchSuggestions = {
  query: string;
  products: {
    slug: string;
    name: string;
    price: number;
    from: boolean;
    currency: string;
    imageUrl?: string;
  }[];
  categories: { slug: string; name: string }[];
};
