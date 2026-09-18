const STOP = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "can", "this", "that", "these", "those", "i", "you", "he", "she", "it",
  "we", "they", "my", "your", "our", "their", "what", "which", "who", "how",
  "when", "where", "why", "with", "from", "as", "by", "about", "into", "over",
  "after", "before", "between", "under", "again", "further", "then", "once",
  "here", "there", "all", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
  "very", "just", "also", "if", "up", "out", "any", "me", "him", "her", "us",
  "them", "am", "its",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s$%/.-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9$]+|[^a-z0-9%]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}
