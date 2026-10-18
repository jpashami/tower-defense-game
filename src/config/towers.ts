export type TowerKey = 'archer' | 'cannon' | 'frost' | 'lightning' | 'ballista';

/** Which enemy in range a tower shoots at. */
export type TargetMode = 'first' | 'strongest' | 'closest';
export const TARGET_MODES: TargetMode[] = ['first', 'strongest', 'closest'];

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
  /** Lightning: how many enemies one bolt jumps between, and how far each jump reaches. */
  chain?: { count: number; range: number };
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
  /** Can target flying enemies. */
  hitsAir: boolean;
  /** Ignores enemy armour. */
  pierce?: boolean;
  /** Fires instantly instead of launching a projectile (Lightning). */
  instant?: boolean;
  /** The shop keeps this tower locked until this wave has started. */
  unlockWave?: number;
  defaultTarget: TargetMode;
}

export const TOWERS: Record<TowerKey, TowerDef> = {
  archer: {
    key: 'archer',
    name: 'Archer',
    description: 'Fast single shots. Hits flyers. Weak against armour.',
    cost: 50,
    upgradeCosts: [70, 140],
    levels: [
      { damage: 10, range: 96, cooldown: 0.55, projectileSpeed: 420, splash: 0 },
      { damage: 18, range: 108, cooldown: 0.45, projectileSpeed: 480, splash: 0 },
      { damage: 30, range: 120, cooldown: 0.35, projectileSpeed: 540, splash: 0 },
    ],
    baseTexture: 'base_archer',
    headTexture: 'head_archer',
    projectileTexture: 'proj_archer',
    rotates: true,
    hitsAir: true,
    defaultTarget: 'first',
  },
  cannon: {
    key: 'cannon',
    name: 'Cannon',
    description: 'Heavy shells that hit groups. Cannot hit flyers.',
    cost: 90,
    upgradeCosts: [100, 200],
    levels: [
      { damage: 26, range: 88, cooldown: 1.4, projectileSpeed: 240, splash: 40 },
      { damage: 44, range: 100, cooldown: 1.25, projectileSpeed: 260, splash: 50 },
      { damage: 70, range: 112, cooldown: 1.1, projectileSpeed: 280, splash: 60 },
    ],
    baseTexture: 'base_cannon',
    headTexture: 'head_cannon',
    projectileTexture: 'proj_cannon',
    rotates: true,
    hitsAir: false,
    defaultTarget: 'first',
  },
  frost: {
    key: 'frost',
    name: 'Frost',
    description: 'Chills enemies so they walk slower. Cannot hit flyers.',
    cost: 60,
    upgradeCosts: [70, 150],
    levels: [
      { damage: 3, range: 80, cooldown: 0.9, projectileSpeed: 320, splash: 0, slow: { factor: 0.5, duration: 1.6 } },
      { damage: 6, range: 96, cooldown: 0.75, projectileSpeed: 340, splash: 30, slow: { factor: 0.4, duration: 2 } },
      { damage: 10, range: 108, cooldown: 0.6, projectileSpeed: 360, splash: 44, slow: { factor: 0.3, duration: 2.4 } },
    ],
    baseTexture: 'base_frost',
    headTexture: 'head_frost',
    projectileTexture: 'proj_frost',
    rotates: false,
    hitsAir: false,
    defaultTarget: 'first',
  },
  lightning: {
    key: 'lightning',
    name: 'Lightning',
    description: 'Bolts jump between enemies, air included. Unlocks on wave 4.',
    cost: 150,
    upgradeCosts: [140, 260],
    levels: [
      { damage: 16, range: 88, cooldown: 1.1, projectileSpeed: 0, splash: 0, chain: { count: 3, range: 64 } },
      { damage: 24, range: 96, cooldown: 0.95, projectileSpeed: 0, splash: 0, chain: { count: 4, range: 72 } },
      { damage: 34, range: 104, cooldown: 0.8, projectileSpeed: 0, splash: 0, chain: { count: 6, range: 80 } },
    ],
    baseTexture: 'base_lightning',
    headTexture: 'head_lightning',
    projectileTexture: 'px',
    rotates: false,
    hitsAir: true,
    instant: true,
    unlockWave: 4,
    defaultTarget: 'first',
  },
  ballista: {
    key: 'ballista',
    name: 'Ballista',
    description: 'Huge bolts that pierce armour, from very far away. Unlocks on wave 7.',
    cost: 200,
    upgradeCosts: [180, 320],
    levels: [
      { damage: 90, range: 192, cooldown: 2.4, projectileSpeed: 720, splash: 0 },
      { damage: 150, range: 216, cooldown: 2.1, projectileSpeed: 780, splash: 0 },
      { damage: 240, range: 240, cooldown: 1.8, projectileSpeed: 840, splash: 0 },
    ],
    baseTexture: 'base_ballista',
    headTexture: 'head_ballista',
    projectileTexture: 'proj_ballista',
    rotates: true,
    hitsAir: true,
    pierce: true,
    unlockWave: 7,
    defaultTarget: 'strongest',
  },
};

/** Shop order; also the 1-5 hotkeys. */
export const TOWER_ORDER: TowerKey[] = ['archer', 'cannon', 'frost', 'lightning', 'ballista'];

/** The towers Creator levels can tune. Fixed so existing share codes keep working. */
export type CreatorTowerKey = 'archer' | 'cannon' | 'frost';
export const CREATOR_TOWERS: CreatorTowerKey[] = ['archer', 'cannon', 'frost'];
