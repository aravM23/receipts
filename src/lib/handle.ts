/**
 * Normalize whatever the user pastes into a bare IG username.
 *
 * Accepts:
 *   "@kylie"                       → "kylie"
 *   "Kylie"                        → "kylie"
 *   "instagram.com/kylie"          → "kylie"
 *   "https://www.instagram.com/kylie/?hl=en" → "kylie"
 *
 * Returns null when there's nothing usable.
 */
export function normalizeHandle(input: string): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;

  // Pull the username out of an instagram URL if they pasted one.
  const urlMatch = s.match(/instagram\.com\/([^/?#]+)/i);
  if (urlMatch) s = urlMatch[1];

  // Strip a leading @ and any stray slashes/whitespace.
  s = s.replace(/^@+/, "").replace(/[/\s]+/g, "");

  // IG usernames: letters, numbers, periods, underscores.
  s = s.toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(s)) return null;
  return s;
}
