// Keeps letters, numbers and combining marks from any script, so Nepali names still work.
// Returns "" when the text has none of them.
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
