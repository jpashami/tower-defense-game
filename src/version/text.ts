/**
 * Cleaning for any text that arrives in a family version (names, tips, descriptions).
 * Only letters the pixel font can draw survive; web and email addresses are dropped
 * and a short list of rude words is masked. The game only ever draws this text on the
 * canvas (Phaser text) or puts it in a text box's value, never into HTML.
 */

/** Characters version text may use. */
const ALLOWED = /[^A-Za-z0-9 .,!?'\-:()&]/g;

/** Anything that looks like a web or email address. */
const ADDRESS = /\b(?:https?|www|ftp)\b|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|uk|us|ly|gg|me|tv|app|xyz|info|biz|link|site|online|dev|ai|be|de|fr|ru|cn)\b/gi;

/**
 * Masked wherever they appear as whole words. Kept short on purpose: this catches
 * the obvious, and parents see every version's summary before anyone plays it.
 */
const RUDE = [
  'arse', 'arsehole', 'ass', 'asshole', 'bastard', 'bitch', 'bollocks', 'cunt', 'dick',
  'dickhead', 'fag', 'fuck', 'fucker', 'fucking', 'goddamn', 'nigger', 'nigga', 'piss', 'pissed', 'porn',
  'prick', 'pussy', 'retard', 'sex', 'sexy', 'shit', 'shitty', 'slut', 'twat', 'wank', 'wanker', 'whore', 'kill yourself',
];
const RUDE_RE = new RegExp(`\\b(?:${RUDE.map((w) => w.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');

/** Version text made safe and short. `upper` turns it to capitals (names and titles). */
export function cleanText(raw: unknown, maxLength: number, upper = false): string {
  if (typeof raw !== 'string') return '';
  let s = raw.slice(0, maxLength * 4).normalize('NFKD').replace(ALLOWED, ' ');
  s = s.replace(ADDRESS, ' ').replace(RUDE_RE, (w) => '*'.repeat(Math.min(w.length, 6)));
  s = s.replace(/\s+/g, ' ').trim();
  if (upper) s = s.toUpperCase();
  return s.slice(0, maxLength).trim();
}

/** An id such as "ghost" or "fire_tower": lower case letters, digits and underscores, starting with a letter. */
export function cleanId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return /^[a-z][a-z0-9_]{0,15}$/.test(s) ? s : null;
}

/** A "#rrggbb" colour as a number, or null. */
export function parseColour(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(raw.trim());
  return m ? parseInt(m[1], 16) : null;
}

/** A number as "#rrggbb". */
export const colourHex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
