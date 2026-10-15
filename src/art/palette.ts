/**
 * Sweetie-16 palette plus three earth tones.
 * Each sprite grid character maps to one colour; '.' is transparent.
 */
export const PALETTE: Record<string, string> = {
  '0': '#1a1c2c', // near black
  '1': '#5d275d', // plum
  '2': '#b13e53', // red
  '3': '#ef7d57', // orange
  '4': '#ffcd75', // yellow
  '5': '#a7f070', // light green
  '6': '#38b764', // green
  '7': '#257179', // teal
  '8': '#29366f', // navy
  '9': '#3b5dc9', // blue
  a: '#41a6f6', // light blue
  b: '#73eff7', // cyan
  c: '#f4f4f4', // white
  d: '#94b0c2', // light grey
  e: '#566c86', // grey
  f: '#333c57', // dark grey
  g: '#7a4a2a', // dark wood
  h: '#c69060', // wood
  i: '#e0b884', // sand
};

/** Palette colour as a number, for tints and Graphics fills. */
export function col(ch: string): number {
  return parseInt(PALETTE[ch].slice(1), 16);
}
