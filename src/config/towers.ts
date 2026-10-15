export type TowerKey = 'archer' | 'cannon' | 'frost';

/** Combat numbers for one upgrade level of a tower. */
export interface TowerStats {
  damage: number;
  /** Targeting radius in pixels. */
  range: number;
  /** Seconds between shots. */
  cooldown: number;
  projectileSpeed: number;
  /** Radius of area damage in pixels; 0 means single target. */
  splash: number;
  /** Optional slow applied on hit: speed multiplier and duration in seconds. */
  slow?: { factor: number; duration: number };
}

export interface TowerDef {
  key: TowerKey;
  name: string;
  description: string;
  cost: number;
  /** upgradeCosts[i] buys level i+1. Its length must be levels.length - 1. */
  upgradeCosts: number[];
  levels: TowerStats[];
  baseTexture: string;
  headTexture: string;
  projectileTexture: string;
  /** Whether the head turns to face its target. */
  rotates: boolean;
}

export const TOWERS: Record<TowerKey, TowerDef> = {
  archer: {
    key: 'archer',
    name: 'Archer',
    description: 'Fast shots at a single target.',
    cost: 50,
    upgradeCosts: [70],
    levels: [
      { damage: 10, range: 96, cooldown: 0.55, projectileSpeed: 420, splash: 0 },
      { damage: 20, range: 112, cooldown: 0.4, projectileSpeed: 480, splash: 0 },
    ],
    baseTexture: 'base_archer',
    headTexture: 'head_archer',
    projectileTexture: 'proj_archer',
    rotates: true,
  },
  cannon: {
    key: 'cannon',
    name: 'Cannon',
    description: 'Slow, heavy shells that hit groups.',
    cost: 90,
    upgradeCosts: [100],
    levels: [
      { damage: 26, range: 88, cooldown: 1.4, projectileSpeed: 240, splash: 40 },
      { damage: 48, range: 104, cooldown: 1.2, projectileSpeed: 260, splash: 52 },
    ],
    baseTexture: 'base_cannon',
    headTexture: 'head_cannon',
    projectileTexture: 'proj_cannon',
    rotates: true,
  },
  frost: {
    key: 'frost',
    name: 'Frost',
    description: 'Chills enemies so they walk slower.',
    cost: 60,
    upgradeCosts: [70],
    levels: [
      { damage: 3, range: 80, cooldown: 0.9, projectileSpeed: 320, splash: 0, slow: { factor: 0.5, duration: 1.6 } },
      { damage: 6, range: 96, cooldown: 0.75, projectileSpeed: 340, splash: 30, slow: { factor: 0.35, duration: 2 } },
    ],
    baseTexture: 'base_frost',
    headTexture: 'head_frost',
    projectileTexture: 'proj_frost',
    rotates: false,
  },
};

/** Shop order; also the 1/2/3 hotkeys. */
export const TOWER_ORDER: TowerKey[] = ['archer', 'cannon', 'frost'];
