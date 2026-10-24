import type Phaser from 'phaser';
import { BETWEEN_WAVES } from '../config/constants';
import type { DifficultyKey } from '../config/difficulty';
import { tileCenter, type Point } from '../config/map';
import type { MapMode } from '../config/settings';
import { METEOR } from '../config/spells';
import type { TowerKey } from '../config/towers';
import type { GameScene } from '../scenes/GameScene';
import { fx } from '../systems/Effects';
import { EXAMPLE_VERSIONS } from '../version/examples';
import { setActiveVersion, useSavedVersion } from '../version/registry';
import { checkVersion } from '../version/validate';

/**
 * Development-only test player used to balance the difficulty levels.
 * It plays whole games at a fixed 60 steps per second without rendering, so a
 * game takes about a second. Open the browser console on the dev server and run:
 *
 *   await simulateMany({ difficulty: 'normal', strategy: 'smart', games: 10 })
 *
 * Strategies:
 *   smart  - builds a mix of every tower, upgrades, and uses both spells
 *   medium - only the three basic towers, upgrades to level 2, no spells
 *   naive  - archers only, no upgrades, no spells
 */

export type Strategy = 'smart' | 'medium' | 'naive';

export interface SimOptions {
  difficulty: DifficultyKey;
  strategy: Strategy;
  seed?: number;
  map?: MapMode;
  /** Play one of the example family versions (src/version/examples.ts) instead of the default game. */
  version?: string;
}

export interface SimResult {
  seed: number;
  won: boolean;
  wave: number;
  lives: number;
  /** Lives left at the start of each wave. */
  livesAtWave: number[];
  /** Lives lost to each enemy type. */
  leaks: Partial<Record<string, number>>;
}

const CYCLES: Record<Strategy, TowerKey[]> = {
  smart: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'lightning', 'frost', 'ballista', 'cannon', 'lightning', 'ballista', 'archer', 'lightning', 'ballista', 'cannon'],
  medium: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'archer', 'frost', 'cannon'],
  naive: ['archer'],
};

/** Points every 8px along a route, for measuring how much of it a tile can reach. */
function samples(route: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 8));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out.filter((p) => p.x >= 0);
}

class Bot {
  private cycle = 0;
  private readonly pts: Point[];
  /** The flyers' straight line, which only air-capable towers care about. */
  private readonly airPts: Point[];
  private readonly rand: () => number;

  constructor(
    private readonly gs: GameScene,
    private readonly strategy: Strategy,
    seed: number,
  ) {
    this.pts = [...samples(gs.mainRoute), ...samples(gs.shortcutRoute ?? []), ...samples(gs.boatRoute ?? []), ...gs.extraRoutes.flatMap(samples)];
    const r = gs.mainRoute;
    this.airPts = samples([r[0], r[r.length - 1]]);
    let s = seed * 31 + 7;
    this.rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
  }

  act(): void {
    const gs = this.gs;
    if (this.strategy === 'smart') this.castSpells();
    for (let guard = 0; guard < 20; guard++) if (!this.spendOnce()) break;
    if (gs.phase === 'build' && (gs.countdown === 0 || gs.countdown < BETWEEN_WAVES - 1)) gs.startNextWave();
  }

  private coverage(col: number, row: number, range: number, air = false): number {
    const { x, y } = tileCenter(col, row);
    const r = Math.min(range, 140);
    let n = 0;
    for (const p of this.pts) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) n++;
    // Smart players also guard the flyers' line with towers that can hit them.
    if (air && this.strategy === 'smart') for (const p of this.airPts) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) n += 2;
    return n;
  }

  private bestTile(range: number, air: boolean): { col: number; row: number } | null {
    const options: { col: number; row: number; score: number }[] = [];
    for (let row = 0; row < this.gs.rows; row++) {
      for (let col = 0; col < this.gs.cols; col++) {
        if (!this.gs.isBuildable(col, row)) continue;
        options.push({ col, row, score: this.coverage(col, row, range, air) });
      }
    }
    if (options.length === 0) return null;
    options.sort((a, b) => b.score - a.score);
    // The naive player picks a random spot among the better half.
    if (this.strategy === 'naive') return options[Math.floor(this.rand() * Math.ceil(options.length / 2))];
    return options[0];
  }

  /** Builds or upgrades one thing; returns false when nothing affordable is left to do. */
  private spendOnce(): boolean {
    const gs = this.gs;
    const towers = gs.allTowers;
    const wantBuild = this.strategy === 'naive' || towers.length < 2 + gs.waves.current;
    if (!wantBuild) {
      const maxLevel = this.strategy === 'medium' ? 1 : 2;
      const candidates = towers
        .filter((t) => !t.isMaxLevel && t.level < maxLevel)
        .sort((a, b) => this.coverage(b.col, b.row, b.stats.range) - this.coverage(a.col, a.row, a.stats.range));
      const t = candidates[0];
      if (t && t.upgradeCost !== null) {
        if (!gs.economy.canAfford(t.upgradeCost)) return false;
        gs.selected = t;
        gs.upgradeSelected();
        gs.selected = null;
        return true;
      }
    }
    // Versions with their own towers: the bot just cycles through their shop.
    const cycle: string[] = CYCLES[this.strategy].every((k) => gs.towerOrder.includes(k)) ? CYCLES[this.strategy] : gs.towerOrder;
    let key: string | null = null;
    for (let k = 0; k < cycle.length; k++) {
      const candidate = cycle[(this.cycle + k) % cycle.length];
      if (gs.isUnlocked(candidate)) {
        key = candidate;
        this.cycle += k;
        break;
      }
    }
    if (!key) return false;
    const def = gs.towerDefs[key];
    if (!gs.economy.canAfford(def.cost)) return false;
    const tile = this.bestTile(def.levels[0].range, def.hitsAir);
    if (!tile || !gs.tryPlace(key, tile.col, tile.row)) return false;
    this.cycle++;
    return true;
  }

  private castSpells(): void {
    const gs = this.gs;
    if (gs.phase !== 'wave') return;
    const enemies = gs.allEnemies.filter((e) => e.targetable);
    if (enemies.length === 0) return;
    const danger = enemies.some((e) => e.remaining < e.routeLength * 0.2);
    if (gs.spellReady('meteor')) {
      let best: { x: number; y: number; score: number } | null = null;
      for (const e of enemies) {
        if (e.flying) continue;
        let score = 0;
        for (const o of enemies) {
          if (!o.flying && Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) <= METEOR.radius) score += o.def.boss ? 6 : 1;
        }
        if (!best || score > best.score) best = { x: e.pos.x, y: e.pos.y, score };
      }
      if (best && (best.score >= 5 || danger)) gs.dropMeteor(best.x, best.y);
    }
    if (gs.spellReady('freeze') && (danger || enemies.some((e) => e.def.boss && e.remaining < e.routeLength * 0.5))) {
      gs.castSpell('freeze');
    }
  }
}

/** Plays one whole game without rendering and reports how it went. */
export function simulate(game: Phaser.Game, opts: SimOptions): SimResult {
  const seed = opts.seed ?? 1 + Math.floor(Math.random() * 9998);
  fx.enabled = false;
  const scenes = game.scene;
  game.loop.sleep();
  for (const key of ['GameOver', 'UI', 'Menu', 'Editor', 'Versions', 'Players']) if (scenes.isActive(key) || scenes.isPaused(key)) scenes.stop(key);
  setActiveVersion(useVersion(opts.version));
  scenes.start('Game', { difficulty: opts.difficulty, seed, map: opts.map ?? 'random' });
  let t = performance.now();
  for (let k = 0; k < 4; k++) game.step((t += 16.7), 16.7);
  const gs = scenes.getScene('Game') as GameScene;
  scenes.pause('UI');

  const bot = new Bot(gs, opts.strategy, seed);
  const livesAtWave: number[] = [];
  let last = -1;
  for (let i = 0; i < 60 * 60 * 40 && !gs.isOver; i++) {
    if (i % 6 === 0) bot.act();
    gs.update(0, 1000 / 60);
    if (gs.waves.current !== last) {
      last = gs.waves.current;
      if (last > 0) livesAtWave.push(gs.economy.lives);
    }
  }
  game.loop.wake();
  fx.enabled = true;
  return { seed, won: gs.phase === 'won', wave: gs.waves.current, lives: gs.economy.lives, livesAtWave, leaks: { ...gs.leaks } };
}

/** A checked example version by key, or null for the default game. */
function useVersion(key?: string) {
  if (!key) return null;
  const r = checkVersion(EXAMPLE_VERSIONS[key]);
  if (!r.ok) throw new Error(`No example version "${key}"`);
  return r.version;
}

/** Plays several games and summarises them. */
export function simulateMany(
  game: Phaser.Game,
  opts: Omit<SimOptions, 'seed'> & { games?: number; seeds?: number[] },
): string {
  const seeds = opts.seeds ?? Array.from({ length: opts.games ?? 8 }, (_, i) => 101 + i * 37);
  const results = seeds.map((seed) => simulate(game, { ...opts, seed }));
  const wins = results.filter((r) => r.won);
  const losses = results.filter((r) => !r.won);
  const leaks: Record<string, number> = {};
  for (const r of results) for (const [k, v] of Object.entries(r.leaks)) leaks[k] = (leaks[k] ?? 0) + (v ?? 0);
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '-');
  return (
    `${opts.difficulty} ${opts.strategy}: won ${wins.length}/${results.length}` +
    ` | avg lives left on wins ${avg(wins.map((r) => r.lives))}` +
    ` | avg wave lost ${avg(losses.map((r) => r.wave))}` +
    ` | waves lost on: ${losses.map((r) => r.wave).join(',') || '-'}` +
    ` | lives lost to: ${Object.entries(leaks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}`
  );
}

/** Puts simulate helpers on window (dev server only). */
export function install(game: Phaser.Game): void {
  const w = window as unknown as Record<string, unknown>;
  // Leave the title screen showing afterwards rather than a half-finished test game.
  const backToMenu = <T>(result: T): T => {
    useSavedVersion();
    game.scene.stop('UI');
    game.scene.stop('Game');
    game.scene.start('Menu');
    return result;
  };
  w.simulate = (opts: SimOptions) => backToMenu(simulate(game, opts));
  w.simulateMany = (opts: Omit<SimOptions, 'seed'> & { games?: number; seeds?: number[] }) =>
    backToMenu(simulateMany(game, opts));
  // Opens an example version in a real game, e.g. playExample('river_raid').
  w.playExample = (key: string) => {
    setActiveVersion(useVersion(key));
    for (const k of ['GameOver', 'UI', 'Game', 'Menu', 'Versions']) game.scene.stop(k);
    game.scene.start('Game', {});
  };
}
