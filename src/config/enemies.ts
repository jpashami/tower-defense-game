export type EnemyKey = 'grunt' | 'runner' | 'brute' | 'knight' | 'wolf' | 'shaman' | 'wyvern' | 'warlord';
/** The enemies Creator levels can use. Fixed so existing share codes keep working. */
export type CreatorEnemyKey = 'grunt' | 'runner' | 'brute';

/** When a triggered enemy ability goes off. Radii are in pixels. */
export type EnemyTrigger =
  | { kind: 'spawn' }
  | { kind: 'hit' }
  | { kind: 'death' }
  | { kind: 'every'; seconds: number }
  | { kind: 'below'; percent: number }
  | { kind: 'near'; radius: number };

/** What a triggered ability does. Distances are in pixels, amounts are fractions of max health. */
export type EnemyAction =
  | { type: 'spawn'; enemy: string; count: number }
  | { type: 'teleport'; distance: number }
  | { type: 'speed'; factor: number; duration: number }
  | { type: 'explode'; radius: number; damage: number; stun: number }
  | { type: 'shield'; amount: number }
  | { type: 'cloak'; duration: number }
  | { type: 'heal'; amount: number };

export interface EnemyAbility {
  when: EnemyTrigger;
  action: EnemyAction;
}

export interface EnemyDef {
  /** A built-in EnemyKey, or an id from a family version. */
  key: string;
  name: string;
  /** One-line tip shown in the next-wave preview. */
  tip: string;
  texture: string;
  /** Hit points on wave 1; later waves multiply this. */
  hp: number;
  /** Pixels per second. */
  speed: number;
  /** Gold paid when killed. */
  reward: number;
  /** Lives lost if it reaches the castle. */
  livesCost: number;
  /** Palette colour for its death puff. */
  color: number;
  /** Flat damage removed from every hit (at least 20% of each hit still lands). */
  armor?: number;
  /** Flies straight to the castle, ignoring the path. Only some towers can hit it. */
  flying?: boolean;
  /** Ignores Frost slows and is only half frozen by the Freeze spell. */
  slowImmune?: boolean;
  /** Restores health to nearby enemies every few seconds. */
  heal?: { radius: number; amount: number; interval: number };
  /** Sprite scale (bosses are drawn bigger). */
  scale?: number;
  boss?: boolean;
  /** Hidden from towers unless one with `reveal` is close. */
  stealth?: boolean;
  /** Sails the water route instead of walking the road. */
  boat?: boolean;
  /** Health regained per second, as a fraction of max health. */
  regen?: number;
  /** Starts with a shield worth this fraction of max health; it soaks hits before health does. */
  shield?: number;
  /** Towers within the radius shoot slower: their reload runs at `factor` speed. */
  slowAura?: { radius: number; factor: number };
  /** Attacks the nearest tower in range. Towers have health and break at zero. */
  attack?: { damage: number; range: number; rate: number };
  abilities?: EnemyAbility[];
  /** Colour wash over the sprite (versions that reuse a built-in look). */
  tint?: number;
}

export const ENEMIES: Record<EnemyKey, EnemyDef> = {
  grunt: {
    key: 'grunt',
    name: 'Grunt',
    tip: 'Plain foot soldier.',
    texture: 'enemy_grunt',
    hp: 40,
    speed: 50,
    reward: 5,
    livesCost: 1,
    color: 0x38b764,
  },
  runner: {
    key: 'runner',
    name: 'Runner',
    tip: 'Fast but fragile.',
    texture: 'enemy_runner',
    hp: 22,
    speed: 95,
    reward: 4,
    livesCost: 1,
    color: 0xb13e53,
  },
  brute: {
    key: 'brute',
    name: 'Brute',
    tip: 'Slow and tough.',
    texture: 'enemy_brute',
    hp: 180,
    speed: 32,
    reward: 15,
    livesCost: 3,
    color: 0x5d275d,
  },
  knight: {
    key: 'knight',
    name: 'Knight',
    tip: 'Armour shrugs off arrows. Use cannons or ballistas.',
    texture: 'enemy_knight',
    hp: 140,
    speed: 42,
    reward: 16,
    livesCost: 2,
    color: 0x94b0c2,
    armor: 8,
  },
  wolf: {
    key: 'wolf',
    name: 'Wolf Rider',
    tip: 'Very fast and tough. Slow it with Frost.',
    texture: 'enemy_wolf',
    hp: 120,
    speed: 115,
    reward: 14,
    livesCost: 2,
    color: 0x566c86,
  },
  shaman: {
    key: 'shaman',
    name: 'Shaman',
    tip: 'Heals nearby enemies. Kill it first!',
    texture: 'enemy_shaman',
    hp: 90,
    speed: 44,
    reward: 18,
    livesCost: 1,
    color: 0x73eff7,
    heal: { radius: 64, amount: 14, interval: 1.5 },
  },
  wyvern: {
    key: 'wyvern',
    name: 'Wyvern',
    tip: 'Flies over everything. Only Archer, Lightning and Ballista can hit it.',
    texture: 'enemy_wyvern',
    hp: 110,
    speed: 58,
    reward: 16,
    livesCost: 2,
    color: 0x257179,
    flying: true,
  },
  warlord: {
    key: 'warlord',
    name: 'Warlord',
    tip: 'BOSS. Huge health and armour, cannot be slowed. Costs 6 lives!',
    texture: 'enemy_warlord',
    hp: 1100,
    speed: 26,
    reward: 120,
    livesCost: 6,
    color: 0xb13e53,
    armor: 4,
    slowImmune: true,
    scale: 1.5,
    boss: true,
  },
};
