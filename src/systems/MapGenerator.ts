import { rng } from '../art/draw';
import { COLS, ROWS } from '../config/constants';
import { expandCorners, type Decoration } from '../config/map';
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

export interface GeneratedMap {
  seed: number;
  /** Path corners; the first sits just off the left edge, the last is the castle. */
  corners: [number, number][];
  decorations: Decoration[];
  shortcut: ShortcutDef;
}

/** A fresh random seed for a new map. */
export const randomSeed = (): number => 1 + Math.floor(Math.random() * 9998);

/**
 * Builds a random map: a path that snakes left to right with several up/down runs,
 * a shortcut across one of its U-bends, and scattered trees and rocks.
 * The same seed always gives the same map.
 */
export function generateMap(seed: number): GeneratedMap {
  const rand = rng(seed * 7919 + 13);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  for (let attempt = 0; attempt < 200; attempt++) {
    // Columns for the vertical runs, at least 3 apart so towers fit between them.
    const count = int(4, 5);
    const xs: number[] = [];
    let x = int(2, 4);
    for (let i = 0; i < count && x <= COLS - 3; i++) {
      xs.push(x);
      x += int(3, 4);
    }
    if (xs.length < 4) continue;

    // Rows each run travels between; big swings make long, winding paths.
    const rows: number[] = [int(1, ROWS - 2)];
    for (let i = 0; i < xs.length; i++) {
      const prev = rows[rows.length - 1];
      const options: number[] = [];
      for (let r = 1; r <= ROWS - 2; r++) if (Math.abs(r - prev) >= 4) options.push(r);
      rows.push(options[Math.floor(rand() * options.length)]);
    }

    const corners: [number, number][] = [[-1, rows[0]]];
    xs.forEach((cx, i) => corners.push([cx, rows[i]], [cx, rows[i + 1]]));
    corners.push([COLS - 1, rows[rows.length - 1]]);

    const shortcut = findShortcut(xs, rows, rand);
    if (!shortcut) continue;

    return { seed, corners, decorations: scatter(corners, shortcut, rand), shortcut };
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
function scatter(corners: [number, number][], shortcut: ShortcutDef, rand: () => number): Decoration[] {
  const taken = new Set<string>();
  for (const [c, r] of [...expandCorners(corners), ...shortcut.tiles]) taken.add(`${c},${r}`);
  const out: Decoration[] = [];
  const target = 16 + Math.floor(rand() * 8);
  for (let tries = 0; out.length < target && tries < 500; tries++) {
    const col = Math.floor(rand() * COLS);
    const row = Math.floor(rand() * ROWS);
    const key = `${col},${row}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out.push({ col, row, kind: rand() < 0.7 ? 'tree' : 'rock' });
  }
  return out;
}
