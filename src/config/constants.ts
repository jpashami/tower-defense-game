/** Size of one map tile in screen pixels. */
export const TILE = 32;
/** Sprite grids are drawn at this multiple (16px grid -> 32px tile). */
export const PIXEL_SCALE = 2;

export const COLS = 20;
export const ROWS = 15;
export const MAP_W = TILE * COLS; // 640
export const MAP_H = TILE * ROWS; // 480

/** Width of the HUD panel to the right of the map. */
export const PANEL_W = 160;
export const GAME_W = MAP_W + PANEL_W;
export const GAME_H = MAP_H;

export const START_MONEY = 150;
export const START_LIVES = 20;
/** Fraction of everything spent on a tower that selling refunds. */
export const SELL_REFUND = 0.7;
/** Seconds between waves before the next one starts on its own. */
export const BETWEEN_WAVES = 12;

export const FONT = '"Press Start 2P", monospace';

/** Draw order, lowest first. */
export const DEPTH = {
  ground: 0,
  pathEdge: 1,
  deco: 2,
  towerBase: 3,
  enemy: 4, // plus y/1000 so lower enemies draw in front
  towerHead: 5,
  projectile: 6,
  effect: 7,
  bars: 8,
  range: 9,
  ghost: 10,
  banner: 11,
} as const;
