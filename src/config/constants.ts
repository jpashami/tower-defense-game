/** Size of one map tile in screen pixels. */
export const TILE = 32;

export const COLS = 20;
export const ROWS = 15;
export const MAP_W = TILE * COLS; // 640
export const MAP_H = TILE * ROWS; // 480

/** Width of the HUD panel to the right of the map. */
export const PANEL_W = 160;
export const GAME_W = MAP_W + PANEL_W;
export const GAME_H = MAP_H;

/** Fraction of everything spent on a tower that selling refunds. */
export const SELL_REFUND = 0.7;
/** Seconds between waves before the next one starts on its own. */
export const BETWEEN_WAVES = 12;

export const FONT = '"Press Start 2P", monospace';

/** Draw order, lowest first. Things on the ground add their map y (see view.ts depthAt). */
export const DEPTH = {
  ground: 0, // plus the row, so lower rows draw over the ones behind
  flat: 2, // on the ground: shadows, traps, portals, flowers, clouds, rings
  standing: 4, // plus y/10000: enemies, towers, trees, the castle
  flying: 5.5, // plus y/10000
  projectile: 6,
  effect: 7,
  bars: 8,
  range: 9,
  ghost: 10,
  banner: 11,
} as const;
