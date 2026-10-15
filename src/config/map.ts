import { COLS, ROWS, TILE } from './constants';

export type TileType = 'grass' | 'path' | 'blocked';
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
export const DECORATIONS: { col: number; row: number; kind: 'tree' | 'rock' }[] = [
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
export function pathPoints(): Point[] {
  return PATH_TILES.map(([c, r]) => tileCenter(c, r));
}

/** Builds the tile grid: path from PATH_TILES, blocked from DECORATIONS, the rest grass. */
export function buildGrid(): TileType[][] {
  const grid: TileType[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): TileType => 'grass'),
  );
  const mark = (c: number, r: number, t: TileType) => {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r][c] = t;
  };

  for (let i = 0; i < PATH_TILES.length - 1; i++) {
    const [c0, r0] = PATH_TILES[i];
    const [c1, r1] = PATH_TILES[i + 1];
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = 0; s <= steps; s++) {
      mark(c0 + Math.sign(c1 - c0) * s, r0 + Math.sign(r1 - r0) * s, 'path');
    }
  }
  for (const d of DECORATIONS) {
    if (grid[d.row]?.[d.col] === 'grass') grid[d.row][d.col] = 'blocked';
  }
  return grid;
}
