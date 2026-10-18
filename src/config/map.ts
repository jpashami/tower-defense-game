import { COLS, ROWS, TILE } from './constants';

export type TileType = 'grass' | 'path' | 'shortcut' | 'blocked';
export type DecorationKind = 'tree' | 'rock';
export interface Decoration {
  col: number;
  row: number;
  kind: DecorationKind;
}
export interface Point {
  x: number;
  y: number;
}

/**
 * Corners of the enemy path, in tile coordinates.
 * Enemies walk straight lines between consecutive corners.
 * The first point sits just off the left edge so enemies walk in.
 */
export const PATH_TILES: [number, number][] = [
  [-1, 2],
  [5, 2],
  [5, 7],
  [2, 7],
  [2, 12],
  [9, 12],
  [9, 3],
  [14, 3],
  [14, 10],
  [18, 10],
  [18, 6],
  [19, 6],
];

/** Trees and rocks block building. Any entry that lands on the path is ignored. */
export const DECORATIONS: Decoration[] = [
  { col: 0, row: 0, kind: 'tree' },
  { col: 1, row: 0, kind: 'tree' },
  { col: 7, row: 0, kind: 'tree' },
  { col: 12, row: 0, kind: 'tree' },
  { col: 17, row: 1, kind: 'tree' },
  { col: 19, row: 0, kind: 'tree' },
  { col: 0, row: 14, kind: 'tree' },
  { col: 5, row: 14, kind: 'tree' },
  { col: 11, row: 14, kind: 'tree' },
  { col: 16, row: 13, kind: 'tree' },
  { col: 19, row: 14, kind: 'tree' },
  { col: 12, row: 7, kind: 'tree' },
  { col: 7, row: 9, kind: 'tree' },
  { col: 3, row: 4, kind: 'rock' },
  { col: 16, row: 7, kind: 'rock' },
  { col: 11, row: 6, kind: 'rock' },
  { col: 6, row: 10, kind: 'rock' },
  { col: 0, row: 9, kind: 'rock' },
];

export const tileCenter = (col: number, row: number): Point => ({
  x: col * TILE + TILE / 2,
  y: row * TILE + TILE / 2,
});

/** Path corners in pixel coordinates (tile centres). */
export function pathPoints(path: [number, number][] = PATH_TILES): Point[] {
  return path.map(([c, r]) => tileCenter(c, r));
}

/** Builds the tile grid: path from the corners, blocked from decorations, the rest grass. */
export function buildGrid(
  path: [number, number][] = PATH_TILES,
  decorations: Decoration[] = DECORATIONS,
): TileType[][] {
  const grid: TileType[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): TileType => 'grass'),
  );
  const mark = (c: number, r: number, t: TileType) => {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r][c] = t;
  };

  for (let i = 0; i < path.length - 1; i++) {
    const [c0, r0] = path[i];
    const [c1, r1] = path[i + 1];
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = 0; s <= steps; s++) {
      mark(c0 + Math.sign(c1 - c0) * s, r0 + Math.sign(r1 - r0) * s, 'path');
    }
  }
  for (const d of decorations) {
    if (grid[d.row]?.[d.col] === 'grass') grid[d.row][d.col] = 'blocked';
  }
  return grid;
}

/** Every tile along a corner path, in walking order (including the off-screen start). */
export function expandCorners(corners: [number, number][]): [number, number][] {
  const tiles: [number, number][] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const [c0, r0] = corners[i];
    const [c1, r1] = corners[i + 1];
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      tiles.push([c0 + Math.sign(c1 - c0) * s, r0 + Math.sign(r1 - r0) * s]);
    }
  }
  return tiles;
}

/** Collapses a tile-by-tile walk back into corner points. */
export function tilesToCorners(tiles: [number, number][]): [number, number][] {
  if (tiles.length < 2) return [...tiles];
  const out: [number, number][] = [tiles[0]];
  for (let i = 1; i < tiles.length - 1; i++) {
    const [pc, pr] = tiles[i - 1];
    const [c, r] = tiles[i];
    const [nc, nr] = tiles[i + 1];
    if (c - pc !== nc - c || r - pr !== nr - r) out.push(tiles[i]);
  }
  out.push(tiles[tiles.length - 1]);
  return out;
}

/** Length of a walk through pixel points. */
export function routeLength(points: Point[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return d;
}
