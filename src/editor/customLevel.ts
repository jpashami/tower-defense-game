import { COLS, ROWS } from '../config/constants';
import type { CreatorEnemyKey } from '../config/enemies';
import { defaultTuning, type LevelDef, type TowerTuning } from '../config/level';
import { DECORATIONS, PATH_TILES, type Decoration } from '../config/map';
import { CREATOR_TOWERS, type CreatorTowerKey } from '../config/towers';
import { WAVES, type SpawnGroup, type WaveDef } from '../config/waves';

/** How many of each enemy one wave sends. */
export type WaveCounts = Record<CreatorEnemyKey, number>;

/**
 * A level made in the Creator. Kept deliberately simple so it is easy to edit,
 * save and squeeze into a share code; toLevelDef turns it into something playable.
 */
export interface CustomLevel {
  /** Save slot id; unset until first saved. */
  id?: string;
  name: string;
  /** Painted path tiles in walking order. The first is on the left edge, the last is the castle. */
  path: [number, number][];
  decorations: Decoration[];
  waves: WaveCounts[];
  towers: Record<CreatorTowerKey, TowerTuning>;
  startMoney: number;
  startLives: number;
}

export const ENEMY_ORDER: CreatorEnemyKey[] = ['grunt', 'runner', 'brute'];

export const LIMITS = {
  nameLength: 16,
  minPath: 5,
  waves: { min: 1, max: 20 },
  perEnemy: { min: 0, max: 30 },
  money: { min: 25, max: 2000, step: 25 },
  lives: { min: 1, max: 99, step: 1 },
  damage: { min: 1, max: 999 },
  /** Pixels; one tile is 32. */
  range: { min: 32, max: 224, step: 8 },
  cost: { min: 5, max: 500, step: 5 },
} as const;

/** Letters the name may use: the pixel font has them all and they survive share codes. */
export function cleanName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 !?-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, LIMITS.nameLength);
}

/** Damage step that feels right for a tower: about a tenth of its default. */
export function damageStep(key: CreatorTowerKey): number {
  return Math.max(1, Math.round(defaultTuning(key).damage / 10));
}

export function defaultTowers(): Record<CreatorTowerKey, TowerTuning> {
  return Object.fromEntries(CREATOR_TOWERS.map((k) => [k, defaultTuning(k)])) as Record<CreatorTowerKey, TowerTuning>;
}

const counts = (grunt: number, runner = 0, brute = 0): WaveCounts => ({ grunt, runner, brute });

/** An empty field with a gentle five-wave plan, ready for a path. */
export function blankLevel(): CustomLevel {
  return {
    name: 'MY LEVEL',
    path: [],
    decorations: [],
    waves: [counts(6), counts(10), counts(8, 6), counts(12, 6, 1), counts(12, 10, 3)],
    towers: defaultTowers(),
    startMoney: 150,
    startLives: 20,
  };
}

/** The built-in map and waves as a starting point for a new level. */
export function classicLevel(): CustomLevel {
  const path: [number, number][] = [];
  for (let i = 0; i < PATH_TILES.length - 1; i++) {
    const [c0, r0] = PATH_TILES[i];
    const [c1, r1] = PATH_TILES[i + 1];
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      const c = c0 + Math.sign(c1 - c0) * s;
      const r = r0 + Math.sign(r1 - r0) * s;
      if (c >= 0) path.push([c, r]);
    }
  }
  const onPath = new Set(path.map(([c, r]) => `${c},${r}`));
  return {
    name: 'CLASSIC COPY',
    path,
    decorations: DECORATIONS.filter((d) => !onPath.has(`${d.col},${d.row}`)).map((d) => ({ ...d })),
    waves: WAVES.map((w) => {
      const n = counts(0);
      for (const g of w.groups) {
        // Creator levels only use the three classic enemies; skip the rest.
        if (!(ENEMY_ORDER as string[]).includes(g.enemy)) continue;
        const e = g.enemy as CreatorEnemyKey;
        n[e] = Math.min(LIMITS.perEnemy.max, n[e] + g.count);
      }
      return n;
    }),
    towers: defaultTowers(),
    startMoney: 150,
    startLives: 20,
  };
}

/** Whether a tile may be added to the end of the path. */
export function canExtendPath(path: [number, number][], col: number, row: number): boolean {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  if (path.length === 0) return col === 0;
  if (path.some(([c, r]) => c === col && r === row)) return false;
  const [lc, lr] = path[path.length - 1];
  return Math.abs(lc - col) + Math.abs(lr - row) === 1;
}

/** A kid-friendly reason the path can't be played yet, or null when it is fine. */
export function pathProblem(path: [number, number][]): string | null {
  if (path.length === 0) return 'Paint a path first!\nStart on the left edge.';
  if (path.length < LIMITS.minPath) return `The path is too short.\nMake it at least ${LIMITS.minPath} tiles.`;
  if (path[0][0] !== 0) return 'The path must start\non the left edge.';
  for (let i = 1; i < path.length; i++) {
    if (!canExtendPath(path.slice(0, i), path[i][0], path[i][1])) return 'The path has a gap\nor crosses itself.';
  }
  return null;
}

/** Turns the painted tiles into corner points, the format the game walks along. */
export function pathCorners(path: [number, number][]): [number, number][] {
  if (path.length === 0) return [];
  const pts: [number, number][] = [[-1, path[0][1]], ...path];
  const corners: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [pc, pr] = pts[i - 1];
    const [c, r] = pts[i];
    const [nc, nr] = pts[i + 1];
    if (c - pc !== nc - c || r - pr !== nr - r) corners.push(pts[i]);
  }
  corners.push(pts[pts.length - 1]);
  return corners;
}

/** How a wave's enemies are spaced out. Grunts lead, runners catch up, brutes follow. */
const SPACING: Record<CreatorEnemyKey, { interval: number; delay: number }> = {
  grunt: { interval: 0.9, delay: 0 },
  runner: { interval: 0.5, delay: 1.5 },
  brute: { interval: 2.2, delay: 3 },
};

export function waveDef(w: WaveCounts): WaveDef {
  const groups: SpawnGroup[] = ENEMY_ORDER.filter((e) => w[e] > 0).map((enemy) => ({
    enemy,
    count: w[enemy],
    ...SPACING[enemy],
  }));
  return { groups };
}

export const waveTotal = (w: WaveCounts): number => ENEMY_ORDER.reduce((n, e) => n + w[e], 0);

export function toLevelDef(l: CustomLevel): LevelDef {
  return {
    name: l.name || 'MY LEVEL',
    path: pathCorners(l.path),
    decorations: l.decorations,
    waves: l.waves.filter((w) => waveTotal(w) > 0).map(waveDef),
    towers: l.towers,
    startMoney: l.startMoney,
    startLives: l.startLives,
  };
}

export function cloneLevel(l: CustomLevel): CustomLevel {
  return JSON.parse(JSON.stringify(l)) as CustomLevel;
}

const int = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

/** Checks and repairs a level from storage or a share code. Returns null if it is unusable. */
export function normaliseLevel(raw: unknown): CustomLevel | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.path) || !Array.isArray(o.waves)) return null;

  const path: [number, number][] = [];
  for (const p of o.path) {
    if (!Array.isArray(p)) return null;
    const c = int(p[0], -1, COLS, -1);
    const r = int(p[1], -1, ROWS, -1);
    if (!canExtendPath(path, c, r)) return null;
    path.push([c, r]);
  }
  const onPath = new Set(path.map(([c, r]) => `${c},${r}`));
  const seen = new Set<string>();
  const decorations: Decoration[] = [];
  for (const d of Array.isArray(o.decorations) ? o.decorations : []) {
    const dd = d as Partial<Decoration>;
    const col = int(dd.col, -1, COLS, -1);
    const row = int(dd.row, -1, ROWS, -1);
    const key = `${col},${row}`;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS || onPath.has(key) || seen.has(key)) continue;
    if (dd.kind !== 'tree' && dd.kind !== 'rock') continue;
    seen.add(key);
    decorations.push({ col, row, kind: dd.kind });
  }

  const waves = o.waves.slice(0, LIMITS.waves.max).map((w) => {
    const ww = (w ?? {}) as Partial<WaveCounts>;
    const n = counts(0);
    for (const e of ENEMY_ORDER) n[e] = int(ww[e], LIMITS.perEnemy.min, LIMITS.perEnemy.max, 0);
    if (waveTotal(n) === 0) n.grunt = 1;
    return n;
  });
  if (waves.length === 0) return null;

  const towers = defaultTowers();
  const rawTowers = (o.towers ?? {}) as Partial<Record<CreatorTowerKey, Partial<TowerTuning>>>;
  for (const k of CREATOR_TOWERS) {
    const t = rawTowers[k];
    if (!t) continue;
    towers[k] = {
      damage: int(t.damage, LIMITS.damage.min, LIMITS.damage.max, towers[k].damage),
      range: int(t.range, LIMITS.range.min, LIMITS.range.max, towers[k].range),
      cost: int(t.cost, LIMITS.cost.min, LIMITS.cost.max, towers[k].cost),
    };
  }

  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    name: cleanName(typeof o.name === 'string' ? o.name : '') || 'MY LEVEL',
    path,
    decorations,
    waves,
    towers,
    startMoney: int(o.startMoney, LIMITS.money.min, LIMITS.money.max, 150),
    startLives: int(o.startLives, LIMITS.lives.min, LIMITS.lives.max, 20),
  };
}
