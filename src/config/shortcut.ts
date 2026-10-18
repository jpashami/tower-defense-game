/**
 * Shortcut settings. Random maps carve a second, shorter route across a bend
 * of the main path. A barricade keeps it shut until a set wave, then some
 * enemies take it (the share depends on the difficulty, see difficulty.ts).
 * Players can switch shortcuts off on the title screen.
 */
export const SHORTCUT = {
  /** The barricade opens when this wave starts. */
  opensOnWave: 3,
  /** Rows the shortcut must stay away from the main path, so towers fit between. */
  minGap: 2,
};
