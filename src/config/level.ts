import { DECORATIONS, PATH_TILES, type Decoration } from './map';
import { TOWERS, type TowerDef, type TowerKey } from './towers';
import { WAVES, type WaveDef } from './waves';

/** Level-1 numbers a level can change for one tower. Higher levels scale by the same ratio. */
export interface TowerTuning {
  damage: number;
  /** Pixels. */
  range: number;
  cost: number;
}

/** Everything the game needs to play one level. */
export interface LevelDef {
  name: string;
  /** Path corners in tile coordinates; the first sits just off the left edge. */
  path: [number, number][];
  decorations: Decoration[];
  waves: WaveDef[];
  /** Changes to the default towers; missing towers keep their defaults. */
  towers?: Partial<Record<TowerKey, TowerTuning>>;
  /** When unset, the chosen difficulty decides. */
  startMoney?: number;
  startLives?: number;
}

/** The hand-made level the game ships with. */
export const BUILTIN_LEVEL: LevelDef = {
  name: 'Classic',
  path: PATH_TILES,
  decorations: DECORATIONS,
  waves: WAVES,
};

/** The default level-1 numbers for a tower. */
export function defaultTuning(key: TowerKey): TowerTuning {
  const { damage, range } = TOWERS[key].levels[0];
  return { damage, range, cost: TOWERS[key].cost };
}

/** Tower definitions with a level's tuning applied. */
export function levelTowers(level: LevelDef): Record<TowerKey, TowerDef> {
  const out = { ...TOWERS };
  for (const [key, tune] of Object.entries(level.towers ?? {}) as [TowerKey, TowerTuning][]) {
    const def = TOWERS[key];
    const base = defaultTuning(key);
    const dmg = tune.damage / base.damage;
    const rng = tune.range / base.range;
    const cost = tune.cost / base.cost;
    out[key] = {
      ...def,
      cost: tune.cost,
      upgradeCosts: def.upgradeCosts.map((c) => Math.max(1, Math.round(c * cost))),
      levels: def.levels.map((s) => ({
        ...s,
        damage: Math.max(1, Math.round(s.damage * dmg)),
        range: Math.round(s.range * rng),
      })),
    };
  }
  return out;
}
