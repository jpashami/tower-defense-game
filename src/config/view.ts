import { TILE } from './constants';
import type { TileType } from './map';

/**
 * The angled "2.5D" view.
 *
 * The game itself still lives on a flat grid: routes, ranges, towers and enemies all use
 * plain map coordinates (x across, y down, TILE pixels per square). Only drawing changes.
 * Everything on the ground is squashed to SQUASH of its height, as if seen from a slant,
 * standing things (enemies, towers, trees, the castle) are drawn upright at their feet,
 * grass sits a little above the road and water a little below, so steps show as little
 * cliff faces. `project` turns a map point into where it is drawn.
 */

/** Screen height of one map pixel of ground. */
export const SQUASH = 0.75;
/** Screen height of one ground square. */
export const TILE_H = TILE * SQUASH; // 24
/** Room above the top row for tall things standing on it. */
export const TOP_PAD = 34;
/** Room below the bottom row for the map's front edge. */
export const BOTTOM_PAD = 14;
/** How far the map's front edge drops below the lowest ground. */
export const EDGE_DROP = 8;

/** How far each kind of ground stands above road level, in screen pixels. */
export function liftOf(t: TileType | undefined): number {
  switch (t) {
    case 'grass':
    case 'blocked':
      return 6;
    case 'water':
    case 'lava':
      return -4;
    default:
      return 0;
  }
}

/** Where a point on the ground is drawn: `lift` is its ground's height, `z` how far above the ground. */
export function project(x: number, y: number, z = 0, lift = 0): { x: number; y: number } {
  return { x, y: y * SQUASH + TOP_PAD - lift - z };
}

/** The drawn height of a map's ground. */
export function groundTop(row: number): number {
  return row * TILE_H + TOP_PAD;
}

/** Map y under a drawn y (at road level). */
export function unprojectY(sy: number): number {
  return (sy - TOP_PAD) / SQUASH;
}

/** Height of the whole drawing of a map with this many rows. */
export function viewHeight(rows: number): number {
  return rows * TILE_H + TOP_PAD + BOTTOM_PAD;
}

/** Draw order for something standing on the ground at map y: things lower on the map are nearer, so in front. */
export function depthAt(base: number, y: number): number {
  return base + y / 10000;
}
