import { rng } from '../art/draw';
import { COLS, ROWS } from '../config/constants';
import { expandCorners, type Decoration, type TerrainTile } from '../config/map';
import { SHORTCUT } from '../config/shortcut';

/** A second route across a U-bend of the main path. */
export interface ShortcutDef {
  /** Main-path tile where enemies may turn off. */
  from: [number, number];
  /** Main-path tile where the shortcut rejoins. */
  to: [number, number];
  /** The shortcut's own tiles between `from` and `to`, in walking order. */
  tiles: [number, number][];
}

/** Choices for a random map. Leaving them all out gives the classic-size map every seed always gave. */
export interface MapOptions {
  cols?: number;
  rows?: number;
  /** Carve a river from the left edge to a dock on the right edge. */
  river?: boolean;
  /** How many bridges the river should cross the road with (1 to 3). */
  bridges?: number;
  /** How wooded the map is: 0 bare, 1 normal, 2 a forest. */
  trees?: number;
}

export interface GeneratedMap {
  seed: number;
  cols: number;
  rows: number;
  /** Path corners; the first sits just off the left edge, the last is the castle. */
  corners: [number, number][];
  decorations: Decoration[];
  shortcut: ShortcutDef;
  /** River tiles (bridges where they cross the road). */
  terrain: TerrainTile[];
  /** The boats' route as corners, from just off the left edge to the dock; null with no river. */
  boatRoute: [number, number][] | null;
}

/** A fresh random seed for a new map. */
export const randomSeed = (): number => 1 + Math.floor(Math.random() * 9998);

/**
 * Builds a random map: a path that snakes left to right with several up/down runs,
 * a shortcut across one of its U-bends, scattered trees and rocks, and optionally a river.
 * The same seed and options always give the same map.
 */
export function generateMap(seed: number, opts: MapOptions = {}): GeneratedMap {
  const cols = opts.cols ?? COLS;
  const rows = opts.rows ?? ROWS;
  const rand = rng(seed * 7919 + 13);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  // Bigger maps get more up/down runs; at the classic size this is 4 to 5, as it always was.
  const runsLo = Math.round((4 * cols) / COLS);
  const runsHi = Math.round((5 * cols) / COLS);

  for (let attempt = 0; attempt < 200; attempt++) {
    // Columns for the vertical runs, at least 3 apart so towers fit between them.
    const count = int(runsLo, runsHi);
    const xs: number[] = [];
    let x = int(2, 4);
    for (let i = 0; i < count && x <= cols - 3; i++) {
      xs.push(x);
      x += int(3, 4);
    }
    if (xs.length < 4) continue;

    // Rows each run travels between; big swings make long, winding paths.
    const ys: number[] = [int(1, rows - 2)];
    for (let i = 0; i < xs.length; i++) {
      const prev = ys[ys.length - 1];
      const options: number[] = [];
      for (let r = 1; r <= rows - 2; r++) if (Math.abs(r - prev) >= 4) options.push(r);
      ys.push(options[Math.floor(rand() * options.length)]);
    }

    const corners: [number, number][] = [[-1, ys[0]]];
    xs.forEach((cx, i) => corners.push([cx, ys[i]], [cx, ys[i + 1]]));
    corners.push([cols - 1, ys[ys.length - 1]]);

    const shortcut = findShortcut(xs, ys, rand);
    if (!shortcut) continue;

    const decorations = scatter(corners, shortcut, rand, cols, rows, opts.trees ?? 1);
    const river = opts.river ? carveRiver(seed, corners, shortcut, cols, rows, opts.bridges ?? 2) : null;
    const wet = new Set(river?.map(([c, r]) => `${c},${r}`) ?? []);
    return {
      seed,
      cols,
      rows,
      corners,
      decorations: decorations.filter((d) => !wet.has(`${d.col},${d.row}`)),
      shortcut,
      terrain: (river ?? []).map(([col, row]) => ({ col, row, kind: 'water' as const })),
      boatRoute: river ? simplify([[-1, river[0][1]], ...river]) : null,
    };
  }
  throw new Error(`Could not generate a map for seed ${seed}`);
}

/**
 * Looks for a U-bend: a run going one way, a short hop across, then a run coming back.
 * A straight horizontal cut part-way up the U is shorter than walking around it.
 */
function findShortcut(xs: number[], rows: number[], rand: () => number): ShortcutDef | null {
  const candidates: ShortcutDef[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const c = rows[i + 2];
    const down = b > a && b > c;
    const up = b < a && b < c;
    if (!down && !up) continue;
    // Rows both runs pass through, kept away from the bottom of the U.
    const near = down ? Math.max(a, c) : Math.min(a, c);
    for (let m = Math.min(near, b) + 1; m < Math.max(near, b); m++) {
      if (Math.abs(m - b) < SHORTCUT.minGap + 1) continue;
      const tiles: [number, number][] = [];
      for (let cx = xs[i] + 1; cx < xs[i + 1]; cx++) tiles.push([cx, m]);
      candidates.push({ from: [xs[i], m], to: [xs[i + 1], m], tiles });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rand() * candidates.length)];
}

/** Trees and rocks on free grass, never on the path or shortcut. */
function scatter(
  corners: [number, number][],
  shortcut: ShortcutDef,
  rand: () => number,
  cols: number,
  rows: number,
  trees: number,
): Decoration[] {
  const taken = new Set<string>();
  for (const [c, r] of [...expandCorners(corners), ...shortcut.tiles]) taken.add(`${c},${r}`);
  const out: Decoration[] = [];
  const area = (cols * rows) / (COLS * ROWS);
  const target = Math.round((16 + Math.floor(rand() * 8)) * area * trees);
  for (let tries = 0; out.length < target && tries < 500 * area * Math.max(1, trees); tries++) {
    const col = Math.floor(rand() * cols);
    const row = Math.floor(rand() * rows);
    const key = `${col},${row}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out.push({ col, row, kind: rand() < 0.7 ? 'tree' : 'rock' });
  }
  return out;
}

/**
 * A river that flows column by column from the left edge to the right edge,
 * stepping up or down between columns. Where it meets the road it must cross
 * straight over (a bridge), never at a corner and never along the road, and it
 * keeps clear of the shortcut, the portal and the castle. Returns its tiles in
 * flowing order, or null if no good river turns up.
 */
function carveRiver(
  seed: number,
  corners: [number, number][],
  shortcut: ShortcutDef,
  cols: number,
  rows: number,
  wantBridges: number,
): [number, number][] | null {
  const rand = rng(seed * 104729 + 7);
  const road = expandCorners(corners).filter(([c]) => c >= 0);
  // Road direction at each road tile: 'h', 'v' or 'corner'.
  const dir = new Map<string, string>();
  road.forEach(([c, r], i) => {
    const prev = road[i - 1];
    const next = road[i + 1];
    let d = 'corner';
    if (prev && next) {
      if (prev[1] === r && next[1] === r) d = 'h';
      else if (prev[0] === c && next[0] === c) d = 'v';
    }
    dir.set(`${c},${r}`, d);
  });
  const banned = new Set<string>();
  for (const [c, r] of [...shortcut.tiles, shortcut.from, shortcut.to]) banned.add(`${c},${r}`);
  const [castleC, castleR] = corners[corners.length - 1];
  const [, portalR] = corners[0];
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
    banned.add(`${castleC + dc},${castleR + dr}`);
    banned.add(`${dc},${portalR + dr}`);
  }
  const want = Math.max(1, Math.min(3, wantBridges));

  let best: [number, number][] | null = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    const tiles: [number, number][] = [];
    let r = 1 + Math.floor(rand() * (rows - 2));
    let ok = true;
    for (let c = 0; c < cols && ok; c++) {
      // Sometimes swing up or down within this column before flowing on.
      const target = rand() < 0.35 ? Math.max(0, Math.min(rows - 1, r + Math.round((rand() - 0.5) * 8))) : r;
      const step = Math.sign(target - r);
      tiles.push([c, r]);
      while (r !== target) {
        r += step;
        tiles.push([c, r]);
      }
    }
    // Each road tile the river touches must be a straight crossing.
    let bridges = 0;
    for (let i = 0; i < tiles.length && ok; i++) {
      const [c, rr] = tiles[i];
      const key = `${c},${rr}`;
      if (banned.has(key)) ok = false;
      const d = dir.get(key);
      if (!d) continue;
      const prev = tiles[i - 1];
      const next = tiles[i + 1];
      if (!prev || !next || d === 'corner') {
        ok = false;
        continue;
      }
      const flowsH = prev[1] === rr && next[1] === rr;
      const flowsV = prev[0] === c && next[0] === c;
      if ((d === 'h' && flowsV) || (d === 'v' && flowsH)) bridges++;
      else ok = false;
    }
    if (!ok || bridges === 0) continue;
    const score = Math.abs(bridges - want);
    if (score < bestScore) {
      best = tiles;
      bestScore = score;
      if (score === 0) break;
    }
  }
  return best;
}

/** Corner points of a tile-by-tile walk. */
function simplify(tiles: [number, number][]): [number, number][] {
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
