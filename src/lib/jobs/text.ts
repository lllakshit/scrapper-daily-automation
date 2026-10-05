const HTML_TAG = /<[^>]*>/g;
const NON_ALPHANUMERIC = /[^a-z0-9+#.]+/g;

export function stripHtml(value: string): string {
  return value.replace(HTML_TAG, " ").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ");
}

export function normalizeText(value: string): string {
  return stripHtml(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

