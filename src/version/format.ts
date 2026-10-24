/**
 * The family version format: what a version may contain, its limits, and the
 * catalogue of ability blocks. The validator, the Claude prompt and the
 * plain-language summary all read from here, so they never disagree.
 *
 * A version is pure data. Nothing in it is ever run as code.
 */

export const FORMAT = 'pixel-td-version';
export const FORMAT_VERSION = 1;

/** Caps on sizes, counts and every number. Ranges are inclusive. */
export const LIMIT = {
  textBytes: 200_000,
  name: 24,
  author: 20,
  about: 160,
  enemyName: 16,
  tip: 80,
  towerName: 12,
  towerAbout: 80,
  enemies: 12,
  towers: 6,
  traps: 3,
  /** Towers plus traps (the shop has eight slots). */
  shop: 8,
  abilities: 6,
  waves: 30,
  groups: 8,
  colors: 16,
  sprite: { min: 4, max: 32 },
  map: { minCols: 12, maxCols: 32, minRows: 10, maxRows: 22, portals: 2 },
  rules: {
    gold: [25, 5000],
    lives: [1, 100],
    growth: [0, 100],
    speed: [50, 200],
    reward: [25, 400],
    count: [50, 300],
  },
  enemy: { hp: [1, 5000], speed: [0.2, 6], reward: [0, 500], lives: [1, 20], size: [0.5, 2] },
  tower: { cost: [5, 1000], unlock: [0, 30], damage: [0, 2000], range: [0.5, 8], rate: [0.1, 10], splash: [0, 3], upgrade: [1, 2000], hp: [10, 2000] },
  trap: { cost: [5, 500], max: [1, 20], damage: [0, 2000], radius: [0.5, 3], uses: [1, 50], slow: [10, 90], rearm: [0, 500] },
  group: { count: [1, 60], gap: [0.1, 10], wait: [0, 60] },
  random: { bridges: [1, 3], trees: [0, 2] },
} as const;

export type Range = readonly [number, number];

export const MAP_SIZES = {
  small: { cols: 20, rows: 15 },
  medium: { cols: 26, rows: 18 },
  large: { cols: 32, rows: 22 },
} as const;
export type MapSize = keyof typeof MAP_SIZES;

export const BUILTIN_ENEMY_KEYS = ['grunt', 'runner', 'brute', 'knight', 'wolf', 'shaman', 'wyvern', 'warlord'] as const;
/** Ready-made enemy pictures: the built-in enemies plus a few extra looks. */
export const ENEMY_LOOKS = [...BUILTIN_ENEMY_KEYS, 'boat', 'slime', 'bat'] as const;
export const BUILTIN_TOWER_KEYS = ['archer', 'cannon', 'frost', 'lightning', 'ballista'] as const;
export const TRAP_KINDS = ['bomb', 'spikes', 'tar'] as const;
export const SHOT_LOOKS = ['arrow', 'shell', 'frost', 'bolt', 'magic', 'fire', 'poison', 'rock'] as const;
export const TARGETS = ['first', 'strongest', 'closest'] as const;

// ---------------------------------------------------------------- Clean version types

/** When a triggered ability goes off. */
export type When = 'spawn' | 'hit' | 'death' | { every: number } | { below: number } | { near: number };

/** One ability block: a type, its numbers and (for triggered ones) when it happens. */
export interface Ability {
  type: string;
  when?: When;
  [param: string]: string | number | When | undefined;
}

export type Grid = string[];

export interface VEnemy {
  id: string;
  base?: string;
  name?: string;
  tip?: string;
  hp?: number;
  speed?: number;
  reward?: number;
  lives?: number;
  size?: number;
  color?: string;
  look?: string;
  sprite?: { frames: Grid[] };
  abilities?: Ability[];
}

export interface VLevel {
  damage: number;
  range: number;
  rate: number;
  splash?: number;
}

export interface VTower {
  id: string;
  base?: string;
  name?: string;
  about?: string;
  cost?: number;
  unlock?: number;
  levels?: VLevel[];
  upgrades?: number[];
  air?: boolean;
  target?: string;
  hp?: number;
  shot?: string;
  shot_color?: string;
  color?: string;
  look?: string;
  sprite?: { base?: Grid; head?: Grid };
  abilities?: Ability[];
}

export interface VTrap {
  id: string;
  kind: string;
  name?: string;
  about?: string;
  cost?: number;
  max?: number;
  damage?: number;
  radius?: number;
  uses?: number;
  slow?: number;
  rearm?: number;
  color?: string;
}

export interface VGroup {
  enemy: string;
  count: number;
  gap?: number;
  wait?: number;
}

export interface VWave {
  groups: VGroup[];
}

export interface VRandomMap {
  size?: MapSize;
  river?: boolean;
  bridges?: number;
  shortcut?: boolean;
  trees?: number;
}

export interface VDrawnMap {
  rows: string[];
}

export type VMap = VRandomMap | VDrawnMap;

export interface VRules {
  gold?: number;
  lives?: number;
  growth?: number;
  speed?: number;
  reward?: number;
  count?: number;
}

/** A checked, cleaned version. Safe to save, share and play. */
export interface VersionData {
  format: typeof FORMAT;
  v: typeof FORMAT_VERSION;
  name: string;
  author?: string;
  about?: string;
  theme?: { accent?: string; panel?: string };
  rules?: VRules;
  colors?: Record<string, string>;
  enemies?: VEnemy[];
  towers?: VTower[];
  traps?: VTrap[];
  waves?: VWave[];
  map?: VMap;
}

// ---------------------------------------------------------------- Ability catalogue

export interface ParamSpec {
  range?: Range;
  /** Whole numbers only. */
  int?: boolean;
  /** Names another enemy instead of being a number. */
  enemy?: boolean;
  def: number | string;
  doc: string;
}

export interface AbilitySpec {
  side: 'enemy' | 'tower';
  /** 'none': always on. Otherwise the trigger used when "when" is missing. */
  trigger: 'none' | When;
  params: Record<string, ParamSpec>;
  doc: string;
  /** A short plain-language line for the summary screen. */
  describe: (a: Ability) => string;
}

const p = (def: number, range: Range, doc: string, int = false): ParamSpec => ({ def, range, doc, int });
const n = (a: Ability, k: string): number => (typeof a[k] === 'number' ? (a[k] as number) : 0);
const s = (a: Ability, k: string): string => (typeof a[k] === 'string' ? (a[k] as string) : '');

export const ENEMY_ABILITIES: Record<string, AbilitySpec> = {
  attack: {
    side: 'enemy',
    trigger: 'none',
    params: { damage: p(10, [1, 500], 'damage per hit', true), range: p(1.5, [0.5, 5], 'tiles'), rate: p(1, [0.1, 5], 'hits per second') },
    doc: 'Attacks the nearest tower in range. Towers have health; a broken tower stops shooting until the player repairs it. Damaged towers mend after each wave.',
    describe: (a) => `attacks towers (${n(a, 'damage')} damage)`,
  },
  armour: {
    side: 'enemy',
    trigger: 'none',
    params: { amount: p(5, [1, 100], 'damage removed from every hit (at least 20% always lands)', true) },
    doc: 'Shrugs off weak hits.',
    describe: (a) => `armour ${n(a, 'amount')}`,
  },
  flying: { side: 'enemy', trigger: 'none', params: {}, doc: 'Flies straight to the castle over everything. Only towers with "air": true can hit it. Traps miss it.', describe: () => 'flies' },
  boat: { side: 'enemy', trigger: 'none', params: {}, doc: 'Sails the river instead of walking the road. Needs a map with a river. Traps miss it.', describe: () => 'sails the river' },
  boss: { side: 'enemy', trigger: 'none', params: {}, doc: 'A boss: drawn bigger, announced, only half frozen, cannot be slowed.', describe: () => 'BOSS' },
  stealth: { side: 'enemy', trigger: 'none', params: {}, doc: 'Hidden from towers unless a tower with "reveal" is near. Traps and splash still hurt it.', describe: () => 'sneaky (hidden unless revealed)' },
  slow_immune: { side: 'enemy', trigger: 'none', params: {}, doc: 'Cannot be slowed.', describe: () => 'cannot be slowed' },
  regen: {
    side: 'enemy',
    trigger: 'none',
    params: { percent: p(2, [0.5, 20], 'percent of max health regained each second') },
    doc: 'Heals itself slowly.',
    describe: (a) => `regrows ${n(a, 'percent')}% health a second`,
  },
  heal_aura: {
    side: 'enemy',
    trigger: 'none',
    params: { radius: p(2, [0.5, 5], 'tiles'), amount: p(14, [1, 500], 'health given', true), every: p(1.5, [0.5, 20], 'seconds') },
    doc: 'Heals enemies around it every few seconds.',
    describe: (a) => `heals friends ${n(a, 'amount')} every ${n(a, 'every')}s`,
  },
  slow_aura: {
    side: 'enemy',
    trigger: 'none',
    params: { radius: p(2, [0.5, 5], 'tiles'), percent: p(50, [10, 90], 'towers nearby reload at this percent of normal speed', true) },
    doc: 'Towers near it shoot slower.',
    describe: (a) => `towers near it shoot at ${n(a, 'percent')}% speed`,
  },
  shield: {
    side: 'enemy',
    trigger: 'none',
    params: { percent: p(50, [5, 300], 'shield worth this percent of max health', true) },
    doc: 'A shield that soaks up hits before health. Always on from the start; give it "when" to raise it later instead.',
    describe: (a) => `shield ${n(a, 'percent')}%${a.when ? ` ${whenText(a.when)}` : ''}`,
  },
  split: {
    side: 'enemy',
    trigger: 'death',
    params: { into: { enemy: true, def: '', doc: 'id of the enemy it turns into' }, count: p(2, [1, 6], 'how many', true) },
    doc: 'Turns into smaller enemies when beaten (or at another trigger).',
    describe: (a) => `splits into ${n(a, 'count')} ${s(a, 'into').toUpperCase()} ${whenText(a.when ?? 'death')}`,
  },
  summon: {
    side: 'enemy',
    trigger: { every: 5 },
    params: { into: { enemy: true, def: '', doc: 'id of the enemy it calls' }, count: p(1, [1, 4], 'how many each time', true) },
    doc: 'Calls helpers that appear next to it.',
    describe: (a) => `summons ${n(a, 'count')} ${s(a, 'into').toUpperCase()} ${whenText(a.when ?? { every: 5 })}`,
  },
  teleport: {
    side: 'enemy',
    trigger: { every: 6 },
    params: { tiles: p(3, [1, 10], 'how far forward along its route') },
    doc: 'Jumps forward along its route.',
    describe: (a) => `jumps ${n(a, 'tiles')} tiles ${whenText(a.when ?? { every: 6 })}`,
  },
  speed_burst: {
    side: 'enemy',
    trigger: { below: 50 },
    params: { percent: p(200, [110, 400], 'speed as a percent of normal', true), seconds: p(2, [0.5, 10], 'how long') },
    doc: 'Runs much faster for a while.',
    describe: (a) => `sprints ${whenText(a.when ?? { below: 50 })}`,
  },
  explode: {
    side: 'enemy',
    trigger: 'death',
    params: { radius: p(1.5, [0.5, 4], 'tiles'), damage: p(30, [0, 500], 'damage to towers', true), stun: p(2, [0, 10], 'seconds towers stop shooting') },
    doc: 'Blows up, damaging and stunning towers nearby.',
    describe: (a) => `explodes at towers ${whenText(a.when ?? 'death')}`,
  },
  cloak: {
    side: 'enemy',
    trigger: 'hit',
    params: { seconds: p(3, [0.5, 10], 'how long it stays hidden') },
    doc: 'Turns invisible (like stealth) for a while.',
    describe: (a) => `turns invisible ${whenText(a.when ?? 'hit')}`,
  },
  heal: {
    side: 'enemy',
    trigger: { below: 30 },
    params: { percent: p(30, [5, 100], 'percent of max health healed', true) },
    doc: 'Heals itself in one go.',
    describe: (a) => `heals itself ${whenText(a.when ?? { below: 30 })}`,
  },
};

export const TOWER_ABILITIES: Record<string, AbilitySpec> = {
  burn: {
    side: 'tower',
    trigger: 'none',
    params: { damage: p(5, [1, 500], 'damage per second', true), seconds: p(3, [0.5, 10], 'how long it burns') },
    doc: 'Sets enemies on fire. Burning ignores armour.',
    describe: (a) => `burns (${n(a, 'damage')}/s)`,
  },
  poison: {
    side: 'tower',
    trigger: 'none',
    params: { damage: p(4, [1, 500], 'damage per second', true), seconds: p(4, [0.5, 10], 'how long') },
    doc: 'Poisons enemies (like burn, in green).',
    describe: (a) => `poisons (${n(a, 'damage')}/s)`,
  },
  poison_cloud: {
    side: 'tower',
    trigger: 'none',
    params: { damage: p(6, [1, 500], 'damage per second inside', true), radius: p(1, [0.5, 3], 'tiles'), seconds: p(3, [0.5, 10], 'how long it lingers') },
    doc: 'Leaves a poison cloud where shots land.',
    describe: () => 'leaves poison clouds',
  },
  knockback: {
    side: 'tower',
    trigger: 'none',
    params: { tiles: p(0.5, [0.1, 3], 'how far hits push enemies back') },
    doc: 'Pushes enemies back along the road. Bosses are pushed half as far.',
    describe: () => 'knocks enemies back',
  },
  stun: {
    side: 'tower',
    trigger: 'none',
    params: { chance: p(25, [1, 100], 'percent chance per hit', true), seconds: p(1, [0.2, 5], 'how long') },
    doc: 'Sometimes freezes an enemy in place.',
    describe: (a) => `${n(a, 'chance')}% chance to freeze`,
  },
  slow: {
    side: 'tower',
    trigger: 'none',
    params: { percent: p(50, [10, 90], 'enemies walk at this percent of normal speed', true), seconds: p(2, [0.2, 10], 'how long') },
    doc: 'Chills enemies so they walk slower.',
    describe: (a) => `slows to ${n(a, 'percent')}%`,
  },
  slow_aura: {
    side: 'tower',
    trigger: 'none',
    params: { radius: p(2, [0.5, 5], 'tiles'), percent: p(60, [10, 90], 'enemies nearby walk at this percent of normal speed', true) },
    doc: 'Enemies near the tower always walk slower.',
    describe: () => 'slows everything nearby',
  },
  reveal: {
    side: 'tower',
    trigger: 'none',
    params: { radius: p(3, [1, 8], 'tiles') },
    doc: 'Lets every tower see stealthy and invisible enemies near this tower.',
    describe: () => 'reveals hidden enemies',
  },
  multi_shot: {
    side: 'tower',
    trigger: 'none',
    params: { count: p(3, [2, 6], 'enemies hit by each volley', true) },
    doc: 'Shoots several different enemies at once.',
    describe: (a) => `shoots ${n(a, 'count')} at once`,
  },
  critical: {
    side: 'tower',
    trigger: 'none',
    params: { chance: p(20, [1, 100], 'percent chance', true), times: p(3, [1.5, 10], 'damage multiplier') },
    doc: 'Sometimes hits much harder.',
    describe: (a) => `${n(a, 'chance')}% critical hits`,
  },
  chain: {
    side: 'tower',
    trigger: 'none',
    params: { count: p(4, [2, 8], 'enemies one zap hits', true), range: p(2, [1, 4], 'tiles between jumps') },
    doc: 'Fires lightning that jumps between enemies, weakening each jump.',
    describe: (a) => `zaps jump between ${n(a, 'count')}`,
  },
  pierce: { side: 'tower', trigger: 'none', params: {}, doc: 'Ignores armour.', describe: () => 'ignores armour' },
};

/** Plain words for a trigger, e.g. "every 5s" or "when beaten". */
export function whenText(w: When | undefined): string {
  if (!w) return '';
  if (w === 'spawn') return 'when it appears';
  if (w === 'hit') return 'when hit';
  if (w === 'death') return 'when beaten';
  if ('every' in w) return `every ${w.every}s`;
  if ('below' in w) return `below ${w.below}% health`;
  return `near a tower`;
}

/** Characters for a hand-drawn map. */
export const MAP_LEGEND: Record<string, string> = {
  '.': 'grass (towers go here)',
  '#': 'road',
  ':': 'sand road (enemies walk slower)',
  I: 'ice road (enemies slide faster)',
  L: 'lava road (burns enemies)',
  '~': 'water',
  '=': 'bridge (road over water; no towers or traps)',
  T: 'forest (blocks towers)',
  '^': 'rock or mountain (blocks towers)',
  '*': 'flowers (just for looks; towers allowed)',
  P: 'portal where walkers enter (1 or 2, on the road)',
  C: 'castle (exactly 1, at the end of the road)',
  R: 'river start where boats enter (on the water)',
  D: 'dock where boats go (on the water); without one boats sail to water next to the castle',
};
