import { PALETTE } from '../art/palette';
import { TILE } from '../config/constants';
import { DIFFICULTIES, type DifficultyDef, type DifficultyKey } from '../config/difficulty';
import { ENEMIES, type EnemyAbility, type EnemyAction, type EnemyDef, type EnemyTrigger } from '../config/enemies';
import { TOWER_ORDER, TOWERS, type ShotLook, type TargetMode, type TowerDef, type TowerStats } from '../config/towers';
import { TRAPS, type TrapDef } from '../config/traps';
import { WAVES, type WaveDef } from '../config/waves';
import type { MapOptions } from '../systems/MapGenerator';
import { parseDrawnMap, type DrawnMap } from './drawnMap';
import { MAP_SIZES, type Ability, type Grid, type VEnemy, type VersionData, type VTower, type VTrap, type When } from './format';
import { parseColour } from './text';

/** Where a game's map comes from. */
export type MapPlan =
  /** The title screen's own choice: random or the classic map (the default game). */
  | { kind: 'menu' }
  | { kind: 'random'; options: MapOptions; shortcut: boolean }
  | { kind: 'drawn'; map: DrawnMap };

/** A sprite the version drew itself, with the palette it uses. */
export interface SpriteSpec {
  grid: Grid;
  scale: number;
  palette: Record<string, string>;
}

export interface GameRules {
  gold: number;
  lives: number;
  /** Enemy health growth per wave, as a multiple of Normal's. */
  growth: number;
  speed: number;
  reward: number;
  count: number;
}

/** Everything a game is played with: the default game, or a family version on top of it. */
export interface GameContent {
  /** 'classic' for the default game, else a short hash of the version. */
  id: string;
  version: VersionData | null;
  name: string;
  enemies: Record<string, EnemyDef>;
  towers: Record<string, TowerDef>;
  towerOrder: string[];
  traps: Record<string, TrapDef>;
  trapOrder: string[];
  waves: WaveDef[];
  rules: GameRules | null;
  map: MapPlan;
  theme: { accent: number; panel: number };
  sprites: Record<string, SpriteSpec>;
  /** Enemies not worth an introduction card when first seen. */
  familiar: Set<string>;
}

const DEFAULT_THEME = { accent: 0x73eff7, panel: 0x1a1c2c };

export const DEFAULT_CONTENT: GameContent = {
  id: 'classic',
  version: null,
  name: 'CLASSIC',
  enemies: { ...ENEMIES },
  towers: { ...TOWERS },
  towerOrder: [...TOWER_ORDER],
  traps: {},
  trapOrder: [],
  waves: WAVES,
  rules: null,
  map: { kind: 'menu' },
  theme: DEFAULT_THEME,
  sprites: {},
  familiar: new Set(['grunt', 'runner', 'brute']),
};

/** A short, stable id for a version's contents. */
export function versionHash(v: VersionData): string {
  const s = JSON.stringify(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

const tiles = (t: number): number => Math.round(t * TILE);

/** A table entry only if the table itself has it, never something every object inherits. */
function own<T>(table: Record<string, T>, key: string | undefined): T | undefined {
  return key !== undefined && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/** The difficulty for a game: the chosen level, re-centred on a version's own rules. */
export function difficultyFor(key: DifficultyKey, rules: GameRules | null): DifficultyDef {
  const d = DIFFICULTIES[key];
  if (!rules) return d;
  const normal = DIFFICULTIES.normal;
  return {
    ...d,
    startMoney: Math.max(10, Math.round((rules.gold * d.startMoney) / normal.startMoney)),
    startLives: Math.max(1, Math.round((rules.lives * d.startLives) / normal.startLives)),
    hpGrowth: d.hpGrowth * rules.growth,
    rewardMult: d.rewardMult * rules.reward,
    speedMult: d.speedMult * rules.speed,
    countMult: d.countMult * rules.count,
  };
}

/** Turns a checked version into game content. Only reads; never runs anything from the version. */
export function compileVersion(v: VersionData): GameContent {
  const id = versionHash(v);
  const palette: Record<string, string> = { ...PALETTE, ...(v.colors ?? {}) };
  const sprites: Record<string, SpriteSpec> = {};
  const addSprite = (key: string, grid: Grid) => {
    const size = Math.max(grid.length, grid[0].length);
    sprites[key] = { grid, scale: size <= 16 ? 2 : 1, palette };
  };

  const enemies: Record<string, EnemyDef> = { ...ENEMIES };
  for (const e of v.enemies ?? []) enemies[e.id] = compileEnemy(e, id, addSprite);

  let map: MapPlan = { kind: 'menu' };
  if (v.map && 'rows' in v.map) {
    const drawn = parseDrawnMap(v.map.rows);
    if (drawn.ok) map = { kind: 'drawn', map: drawn.map };
  } else if (v.map) {
    const size = MAP_SIZES[v.map.size ?? 'small'];
    map = {
      kind: 'random',
      options: { cols: size.cols, rows: size.rows, river: v.map.river, bridges: v.map.bridges, trees: v.map.trees },
      shortcut: v.map.shortcut ?? true,
    };
  }
  // Boats need water: without a route they walk like everyone else.
  const hasRiver = (map.kind === 'random' && map.options.river) || (map.kind === 'drawn' && map.map.boatRoute !== null);
  if (!hasRiver) for (const e of Object.values(enemies)) if (e.boat) enemies[e.key] = { ...e, boat: false };

  const towers: Record<string, TowerDef> = {};
  const towerOrder: string[] = [];
  if (v.towers?.length) {
    for (const t of v.towers) {
      towers[t.id] = compileTower(t, id, addSprite);
      towerOrder.push(t.id);
    }
  } else {
    Object.assign(towers, TOWERS);
    towerOrder.push(...TOWER_ORDER);
  }

  const traps: Record<string, TrapDef> = {};
  const trapOrder: string[] = [];
  for (const t of v.traps ?? []) {
    traps[t.id] = compileTrap(t);
    trapOrder.push(t.id);
  }

  const waves: WaveDef[] = v.waves?.length
    ? v.waves.map((w) => ({ groups: w.groups.map((g) => ({ enemy: g.enemy, count: g.count, interval: g.gap ?? 1, delay: g.wait ?? 0 })) }))
    : WAVES;

  const r = v.rules;
  const rules: GameRules | null = r
    ? {
        gold: r.gold ?? DIFFICULTIES.normal.startMoney,
        lives: r.lives ?? DIFFICULTIES.normal.startLives,
        growth: (r.growth ?? DIFFICULTIES.normal.hpGrowth * 100) / (DIFFICULTIES.normal.hpGrowth * 100),
        speed: (r.speed ?? 100) / 100,
        reward: (r.reward ?? 100) / 100,
        count: (r.count ?? 100) / 100,
      }
    : null;

  const versionIds = new Set((v.enemies ?? []).map((e) => e.id));
  return {
    id,
    version: v,
    name: v.name,
    enemies,
    towers,
    towerOrder,
    traps,
    trapOrder,
    waves,
    rules,
    map,
    theme: {
      accent: parseColour(v.theme?.accent) ?? DEFAULT_THEME.accent,
      panel: parseColour(v.theme?.panel) ?? DEFAULT_THEME.panel,
    },
    sprites,
    familiar: new Set(['grunt', 'runner', 'brute'].filter((k) => !versionIds.has(k))),
  };
}

function compileEnemy(e: VEnemy, vid: string, addSprite: (key: string, grid: Grid) => void): EnemyDef {
  const builtin = own<EnemyDef>(ENEMIES, e.base ?? e.id);
  const base: EnemyDef = builtin ?? { ...ENEMIES.grunt, tip: 'A new enemy.', armor: undefined };
  const isBoat = !!e.abilities?.some((a) => a.type === 'boat');
  const lookKey = e.look ?? e.base ?? (builtin ? e.id : isBoat ? 'boat' : 'grunt');
  const lookTexture = own<EnemyDef>(ENEMIES, lookKey)?.texture ?? `enemy_${lookKey}`;
  const tint = parseColour(e.color);
  const def: EnemyDef = {
    ...base,
    key: e.id,
    name: e.name ?? (builtin ? base.name : e.id.toUpperCase().replace(/_/g, ' ')),
    tip: e.tip ?? base.tip,
    hp: e.hp ?? base.hp,
    speed: e.speed !== undefined ? tiles(e.speed) : base.speed,
    reward: e.reward ?? base.reward,
    livesCost: e.lives ?? base.livesCost,
    color: tint ?? base.color,
    texture: lookTexture,
    scale: e.size ?? base.scale,
  };
  if (e.sprite?.frames.length) {
    def.texture = `v${vid}_e_${e.id}`;
    addSprite(`${def.texture}_0`, e.sprite.frames[0]);
    addSprite(`${def.texture}_1`, e.sprite.frames[1] ?? e.sprite.frames[0]);
  } else if (tint !== null) def.tint = tint;

  const abilities: EnemyAbility[] = [];
  for (const a of e.abilities ?? []) {
    const n = (k: string) => (typeof a[k] === 'number' ? (a[k] as number) : 0);
    switch (a.type) {
      case 'armour': def.armor = n('amount'); break;
      case 'flying': def.flying = true; break;
      case 'boat': def.boat = true; break;
      case 'boss':
        def.boss = true;
        def.slowImmune = true;
        if (e.size === undefined) def.scale = 1.5;
        break;
      case 'stealth': def.stealth = true; break;
      case 'slow_immune': def.slowImmune = true; break;
      case 'regen': def.regen = n('percent') / 100; break;
      case 'heal_aura': def.heal = { radius: tiles(n('radius')), amount: n('amount'), interval: n('every') }; break;
      case 'slow_aura': def.slowAura = { radius: tiles(n('radius')), factor: n('percent') / 100 }; break;
      case 'attack': def.attack = { damage: n('damage'), range: tiles(n('range')), rate: n('rate') }; break;
      case 'shield':
        if (!a.when) def.shield = n('percent') / 100;
        else abilities.push({ when: trigger(a.when), action: { type: 'shield', amount: n('percent') / 100 } });
        break;
      default: {
        const action = enemyAction(a);
        if (action && a.when) abilities.push({ when: trigger(a.when), action });
      }
    }
  }
  if (abilities.length) def.abilities = abilities;
  if (def.flying) def.boat = false;
  return def;
}

function enemyAction(a: Ability): EnemyAction | null {
  const n = (k: string) => (typeof a[k] === 'number' ? (a[k] as number) : 0);
  switch (a.type) {
    case 'split':
    case 'summon':
      return { type: 'spawn', enemy: String(a.into), count: n('count') };
    case 'teleport': return { type: 'teleport', distance: tiles(n('tiles')) };
    case 'speed_burst': return { type: 'speed', factor: n('percent') / 100, duration: n('seconds') };
    case 'explode': return { type: 'explode', radius: tiles(n('radius')), damage: n('damage'), stun: n('stun') };
    case 'cloak': return { type: 'cloak', duration: n('seconds') };
    case 'heal': return { type: 'heal', amount: n('percent') / 100 };
    default: return null;
  }
}

function trigger(w: When): EnemyTrigger {
  if (w === 'spawn' || w === 'hit' || w === 'death') return { kind: w };
  if ('every' in w) return { kind: 'every', seconds: w.every };
  if ('below' in w) return { kind: 'below', percent: w.below };
  return { kind: 'near', radius: tiles(w.near) };
}

/** Shot speed in pixels per second for each look. */
const SHOT_SPEED: Record<ShotLook, number> = { arrow: 440, shell: 250, frost: 330, bolt: 760, magic: 380, fire: 360, poison: 330, rock: 260 };
const SHOT_TEXTURE: Record<ShotLook, string> = {
  arrow: 'proj_archer',
  shell: 'proj_cannon',
  frost: 'proj_frost',
  bolt: 'proj_ballista',
  magic: 'proj_magic',
  fire: 'proj_fire',
  poison: 'proj_poison',
  rock: 'proj_rock',
};

function compileTower(t: VTower, vid: string, addSprite: (key: string, grid: Grid) => void): TowerDef {
  const builtin = own<TowerDef>(TOWERS, t.base ?? t.id);
  const look = own<TowerDef>(TOWERS, t.look ?? t.base ?? (builtin ? t.id : 'archer')) ?? TOWERS.archer;
  const shot: ShotLook = (t.shot as ShotLook | undefined) ?? builtin?.shot ?? look.shot;
  const cost = t.cost ?? builtin?.cost ?? 60;
  const levels: TowerStats[] = t.levels?.length
    ? t.levels.map((l, i) => {
        // Start from the matching built-in level, so a Frost keeps its chill and a Lightning its jumps.
        const from = builtin?.levels[Math.min(i, builtin.levels.length - 1)];
        return {
          ...from,
          damage: l.damage,
          range: tiles(l.range),
          cooldown: Math.round((1 / l.rate) * 1000) / 1000,
          projectileSpeed: from && !t.shot ? from.projectileSpeed : SHOT_SPEED[shot],
          splash: tiles(l.splash ?? 0),
        };
      })
    : (builtin?.levels ?? [{ damage: 12, range: 96, cooldown: 0.8, projectileSpeed: SHOT_SPEED[shot], splash: 0 }]).map((l) => ({ ...l }));
  const upgradeCosts = Array.from({ length: levels.length - 1 }, (_, i) =>
    t.upgrades?.[i] ?? builtin?.upgradeCosts[i] ?? Math.round(cost * (i === 0 ? 1.4 : 2.8)),
  );
  const tint = parseColour(t.color);
  const def: TowerDef = {
    ...(builtin ?? TOWERS.archer),
    key: t.id,
    name: t.name ?? (builtin ? builtin.name : t.id.toUpperCase().replace(/_/g, ' ')),
    description: t.about ?? builtin?.description ?? 'A tower from this version.',
    cost,
    upgradeCosts,
    levels,
    baseTexture: look.baseTexture,
    headTexture: look.headTexture,
    projectileTexture: SHOT_TEXTURE[shot],
    rotates: look.rotates,
    hitsAir: t.air ?? builtin?.hitsAir ?? false,
    pierce: builtin?.pierce,
    instant: builtin?.instant,
    unlockWave: t.unlock !== undefined ? (t.unlock > 1 ? t.unlock : undefined) : builtin?.unlockWave,
    defaultTarget: (t.target as TargetMode | undefined) ?? builtin?.defaultTarget ?? 'first',
    shot,
    hp: t.hp ?? builtin?.hp,
    shotTint: parseColour(t.shot_color) ?? undefined,
  };
  if (t.sprite?.base) {
    def.baseTexture = `v${vid}_tb_${t.id}`;
    addSprite(def.baseTexture, t.sprite.base);
  }
  if (t.sprite?.head) {
    def.headTexture = `v${vid}_th_${t.id}`;
    addSprite(def.headTexture, t.sprite.head);
  }
  if (tint !== null && !t.sprite) def.tint = tint;

  for (const a of t.abilities ?? []) {
    const n = (k: string) => (typeof a[k] === 'number' ? (a[k] as number) : 0);
    switch (a.type) {
      case 'burn': def.burn = { dps: n('damage'), duration: n('seconds') }; break;
      case 'poison':
        def.burn = { dps: n('damage'), duration: n('seconds') };
        def.shotTint ??= 0xa7f070;
        break;
      case 'poison_cloud': def.cloud = { dps: n('damage'), radius: tiles(n('radius')), duration: n('seconds') }; break;
      case 'knockback': def.knockback = tiles(n('tiles')); break;
      case 'stun': def.stun = { chance: n('chance') / 100, duration: n('seconds') }; break;
      case 'slow':
        for (const l of def.levels) l.slow = { factor: n('percent') / 100, duration: n('seconds') };
        break;
      case 'slow_aura': def.slowAura = { radius: tiles(n('radius')), factor: n('percent') / 100 }; break;
      case 'reveal': def.reveal = tiles(n('radius')); break;
      case 'multi_shot': def.multiShot = n('count'); break;
      case 'critical': def.crit = { chance: n('chance') / 100, mult: n('times') }; break;
      case 'chain':
        for (const l of def.levels) l.chain = { count: n('count'), range: tiles(n('range')) };
        def.instant = true;
        break;
      case 'pierce': def.pierce = true; break;
    }
  }
  return def;
}

function compileTrap(t: VTrap): TrapDef {
  const base = own<TrapDef>(TRAPS, t.kind) ?? TRAPS.tar;
  return {
    ...base,
    key: t.id,
    name: t.name ?? base.name,
    description: t.about ?? base.description,
    cost: t.cost ?? base.cost,
    max: t.max ?? base.max,
    damage: t.damage ?? base.damage,
    radius: t.radius !== undefined ? tiles(t.radius) : base.radius,
    uses: t.uses ?? base.uses,
    slow: t.slow !== undefined ? t.slow / 100 : base.slow,
    rearm: t.rearm ?? base.rearm,
    tint: parseColour(t.color) ?? undefined,
  };
}
