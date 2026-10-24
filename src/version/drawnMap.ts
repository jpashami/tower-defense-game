import type { Decoration, TerrainTile } from '../config/map';
import { LIMIT } from './format';

/** A hand-drawn map turned into routes and terrain the game understands. */
export interface DrawnMap {
  cols: number;
  rows: number;
  /** Main walking route as corners, portal to castle. */
  path: [number, number][];
  /** Route from a second portal, if there is one. */
  extraPaths: [number, number][][];
  terrain: TerrainTile[];
  decorations: Decoration[];
  /** Boats' route as corners, river start to dock; null when the map has no boat route. */
  boatRoute: [number, number][] | null;
}

export type DrawnResult = { ok: true; map: DrawnMap; notes: string[] } | { ok: false; error: string };

const WALK = new Set(['#', ':', 'I', 'L', '=', 'P', 'C']);
const WATER = new Set(['~', '=', 'R', 'D']);
const KNOWN = new Set(['.', '#', ':', 'I', 'L', '~', '=', 'T', '^', '*', 'P', 'C', 'R', 'D']);
const STEPS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Reads a map drawn as rows of characters (legend in format.ts MAP_LEGEND).
 * Checks the size, finds each portal's shortest road to the castle and the
 * boats' water route. Ragged rows are padded with grass.
 */
export function parseDrawnMap(input: unknown): DrawnResult {
  if (!Array.isArray(input) || input.some((r) => typeof r !== 'string')) return { ok: false, error: 'The map rows must be a list of text lines.' };
  const lines = (input as string[]).map((r) => r.replace(/\s+$/, ''));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const rows = lines.length;
  const cols = Math.max(0, ...lines.map((r) => r.length));
  const { minCols, maxCols, minRows, maxRows, portals: maxPortals } = LIMIT.map;
  if (cols < minCols || cols > maxCols || rows < minRows || rows > maxRows) {
    return { ok: false, error: `The map is ${cols}x${rows}; it must be ${minCols}-${maxCols} wide and ${minRows}-${maxRows} tall.` };
  }
  const notes: string[] = [];
  let unknown = 0;
  const g: string[][] = lines.map((line) =>
    Array.from({ length: cols }, (_, c) => {
      const ch = line[c] ?? '.';
      if (KNOWN.has(ch)) return ch;
      if (ch !== ' ') unknown++;
      return '.';
    }),
  );
  if (lines.some((l) => l.length !== cols)) notes.push('Some map rows were short, so grass was added at their ends.');
  if (unknown > 0) notes.push(`${unknown} map squares used unknown letters and became grass.`);

  const find = (ch: string) => {
    const out: [number, number][] = [];
    g.forEach((row, r) => row.forEach((v, c) => v === ch && out.push([c, r])));
    return out;
  };
  const portals = find('P');
  const castles = find('C');
  if (castles.length !== 1) return { ok: false, error: `The map needs exactly one castle (C); it has ${castles.length}.` };
  if (portals.length < 1) return { ok: false, error: 'The map needs a portal (P) where enemies come in.' };
  if (portals.length > maxPortals) return { ok: false, error: `The map can have at most ${maxPortals} portals (P).` };
  const castle = castles[0];

  const routes: [number, number][][] = [];
  for (const portal of portals) {
    const walk = shortestRoute(g, portal, (c, r) => c === castle[0] && r === castle[1], (ch) => WALK.has(ch));
    if (!walk) return { ok: false, error: 'A portal (P) is not joined to the castle (C) by road. Walkers can only cross water on bridges (=).' };
    routes.push(walk);
  }

  let boatRoute: [number, number][] | null = null;
  const starts = find('R');
  if (starts.length > 0) {
    const docks = find('D');
    const goal = docks.length
      ? (c: number, r: number) => g[r][c] === 'D'
      : (c: number, r: number) => Math.abs(c - castle[0]) + Math.abs(r - castle[1]) === 1;
    const sail = shortestRoute(g, starts[0], goal, (ch) => WATER.has(ch));
    if (sail) boatRoute = corners(sail);
    else notes.push('The river start (R) has no water route to a dock (D) or the castle, so boats will walk instead.');
    if (starts.length > 1) notes.push('Only the first river start (R) is used.');
  }

  const terrain: TerrainTile[] = [];
  const decorations: Decoration[] = [];
  g.forEach((row, r) =>
    row.forEach((ch, c) => {
      if (WALK.has(ch)) terrain.push({ col: c, row: r, kind: 'road' });
      if (WATER.has(ch)) terrain.push({ col: c, row: r, kind: 'water' });
      if (ch === ':') terrain.push({ col: c, row: r, kind: 'sand' });
      if (ch === 'I') terrain.push({ col: c, row: r, kind: 'ice' });
      if (ch === 'L') terrain.push({ col: c, row: r, kind: 'lava' });
      if (ch === 'T') decorations.push({ col: c, row: r, kind: 'tree' });
      if (ch === '^') decorations.push({ col: c, row: r, kind: 'rock' });
      if (ch === '*') decorations.push({ col: c, row: r, kind: 'flowers' });
    }),
  );

  return {
    ok: true,
    notes,
    map: { cols, rows, path: corners(routes[0]), extraPaths: routes.slice(1).map(corners), terrain, decorations, boatRoute },
  };
}

/** Breadth-first search over 4-connected squares; returns the walk including both ends. */
function shortestRoute(
  g: string[][],
  start: [number, number],
  isGoal: (c: number, r: number) => boolean,
  passable: (ch: string) => boolean,
): [number, number][] | null {
  const rows = g.length;
  const cols = g[0].length;
  const prev = new Map<number, number>();
  const key = (c: number, r: number) => r * cols + c;
  const queue: [number, number][] = [start];
  prev.set(key(...start), -1);
  for (let i = 0; i < queue.length; i++) {
    const [c, r] = queue[i];
    if (isGoal(c, r) && i > 0) {
      const out: [number, number][] = [];
      let k = key(c, r);
      while (k !== -1) {
        out.push([k % cols, Math.floor(k / cols)]);
        k = prev.get(k)!;
      }
      return out.reverse();
    }
    for (const [dc, dr] of STEPS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || prev.has(key(nc, nr)) || !passable(g[nr][nc])) continue;
      prev.set(key(nc, nr), key(c, r));
      queue.push([nc, nr]);
    }
  }
  return null;
}

/** Corner points of a square-by-square walk. */
function corners(tiles: [number, number][]): [number, number][] {
  if (tiles.length < 3) return tiles;
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
