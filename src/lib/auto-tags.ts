/**
 * Deterministic automatic content tagging — no external services.
 *
 * Combines, in priority order:
 *   1. explicit #hashtags from the body (always kept)
 *   2. top body keywords (frequency- then length-ranked, top 3)
 *   3. filename tokens (extension stripped, split on -_ . and spaces)
 *   4. media-type tags ("video" / "pdf" / "photo")
 *
 * Deduped, capped at 8 tags total. Posts tagged this way feed straight
 * into the feed's tagSimilarity ranking, so text, image, video and PDF
 * posts all surface to users with matching interests.
 */

const MAX_TAGS = 8;
const MAX_BODY_KEYWORDS = 3;
const MIN_WORD_LENGTH = 4;
const MAX_WORD_LENGTH = 20;

const HASHTAG_RE = /#([\p{L}\p{N}_-]{2,24})/gu;
const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
const NON_WORD_RE = /[^\p{L}\p{N}]+/gu;

/** ~120 common English stopwords — filtered out of keyword candidates. */
const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "also", "am",
  "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been",
  "before", "being", "below", "between", "both", "but", "by", "can", "cannot",
  "could", "did", "do", "does", "doing", "down", "during", "each", "few",
  "for", "from", "further", "get", "got", "had", "has", "have", "having",
  "here", "his", "her", "hers", "him", "how", "i", "if", "in", "into", "is",
  "it", "its", "itself", "just", "like", "me", "more", "most", "my", "myself",
  "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other",
  "our", "ours", "out", "over", "own", "same", "she", "should", "so", "some",
  "such", "than", "that", "the", "their", "theirs", "them", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "we", "were", "what", "when", "where", "which",
  "while", "who", "whom", "why", "will", "with", "would", "you", "your",
  "yours", "yourself", "he", "been", "being", "much", "many", "really",
  "thing", "things", "make", "made", "want", "wants", "going", "know",
  "still", "even", "back", "well", "take", "come", "came", "said", "says",
]);

/** True when a lowercased token survives stopword/length filtering. */
function isKeyword(token: string): boolean {
  return (
    token.length >= MIN_WORD_LENGTH &&
    token.length <= MAX_WORD_LENGTH &&
    !STOPWORDS.has(token)
  );
}

/** Explicit #hashtags in the body — lowercased, in order of appearance. */
function hashtagsOf(body: string): string[] {
  const tags: string[] = [];
  for (const match of body.matchAll(HASHTAG_RE)) {
    tags.push(match[1].toLowerCase());
  }
  return tags;
}

/**
 * Top body keywords: lowercase, strip urls + punctuation, split, drop
 * stopwords, keep 4-20 char words, rank by frequency then length.
 */
function bodyKeywords(body: string): string[] {
  const counts = new Map<string, number>();
  const tokens = body
    .toLowerCase()
    .replace(URL_RE, " ")
    .split(NON_WORD_RE);
  for (const token of tokens) {
    if (!isKeyword(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0])
    )
    .slice(0, MAX_BODY_KEYWORDS)
    .map(([word]) => word);
}

/** Filename tokens: extension stripped, split on -_ . and spaces. */
function fileNameTokens(fileNames: string[]): string[] {
  const tokens: string[] = [];
  for (const fileName of fileNames) {
    const stem = fileName.replace(/\.[^.]+$/, "");
    for (const raw of stem.toLowerCase().split(/[-_.\s]+/)) {
      const token = raw.replace(NON_WORD_RE, "");
      if (isKeyword(token)) tokens.push(token);
    }
  }
  return tokens;
}

/** Media-type tags for the kinds of attachments present. */
function mediaTypeTags(mediaTypes: string[]): string[] {
  const tags: string[] = [];
  if (mediaTypes.includes("video")) tags.push("video");
  if (mediaTypes.includes("pdf")) tags.push("pdf");
  if (mediaTypes.includes("image")) tags.push("photo");
  return tags;
}

/**
 * Deterministic auto-tags for a post. Order: explicit #hashtags (highest
 * priority) → top-3 body keywords → filename tokens → media-type tags.
 * Deduped, capped at 8.
 */
export function autoTags(input: {
  body?: string;
  fileNames?: string[];
  mediaTypes?: string[];
}): string[] {
  const candidates = [
    ...hashtagsOf(input.body ?? ""),
    ...bodyKeywords(input.body ?? ""),
    ...fileNameTokens(input.fileNames ?? []),
    ...mediaTypeTags(input.mediaTypes ?? []),
  ];

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const tag of candidates) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}
