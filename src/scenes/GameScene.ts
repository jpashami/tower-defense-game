import Phaser from 'phaser';
import { BETWEEN_WAVES, COLS, DEPTH, FONT, MAP_H, MAP_W, ROWS, TILE } from '../config/constants';
import {
  DIFFICULTIES,
  enemyHpMultiplier,
  killReward,
  loadDifficulty,
  type DifficultyDef,
  type DifficultyKey,
} from '../config/difficulty';
import { ENEMIES, type EnemyKey } from '../config/enemies';
import { BUILTIN_LEVEL, levelTowers, randomLevel, type LevelDef } from '../config/level';
import { buildGrid, expandCorners, pathPoints, tileCenter, tilesToCorners, type Point, type TileType } from '../config/map';
import { loadMapMode, loadShortcutEnabled, type MapMode } from '../config/settings';
import { SHORTCUT } from '../config/shortcut';
import { FREEZE, METEOR, SPELLS, type SpellKey } from '../config/spells';
import { TOWER_ORDER, type TowerDef, type TowerKey } from '../config/towers';
import { waveClearBonus, waveSummary } from '../config/waves';
import { toLevelDef, type CustomLevel } from '../editor/customLevel';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Tower } from '../entities/Tower';
import { Economy } from '../systems/Economy';
import {
  banner,
  burst,
  fx,
  floatText,
  healSparkle,
  lightningBolt,
  meteorFall,
  meteorImpact,
  ring,
} from '../systems/Effects';
import { renderMap } from '../systems/MapRenderer';
import { randomSeed, type ShortcutDef } from '../systems/MapGenerator';
import { MapCamera } from '../systems/MapCamera';
import { PlacementController } from '../systems/PlacementController';
import { WaveManager } from '../systems/WaveManager';
import { isTouchDevice } from '../ui/touch';

export type Phase = 'build' | 'wave' | 'won' | 'lost';

export interface GameData {
  difficulty?: DifficultyKey;
  /** A Creator level to play instead of a random or classic map. */
  custom?: CustomLevel;
  /** Random map to play; a new one is rolled when omitted. */
  seed?: number;
  /** 'classic' plays the original hand-made map. Defaults to the player's saved choice. */
  map?: MapMode;
}

/** Enemies the player already knows from the start, so they get no introduction. */
const BASIC_ENEMIES: EnemyKey[] = ['grunt', 'runner', 'brute'];

/**
 * The battlefield. Owns all game state; the UI scene reads it every frame
 * and calls the public methods below in response to button presses.
 */
export class GameScene extends Phaser.Scene {
  economy!: Economy;
  waves!: WaveManager;
  difficulty!: DifficultyDef;
  level!: LevelDef;
  /** Set when playing a Creator level, so the player can go back to editing it. */
  custom: CustomLevel | null = null;
  mapMode: MapMode = 'random';
  seed = 0;
  /** Tower stats for this level, after any Creator tuning. */
  towerDefs!: Record<TowerKey, TowerDef>;
  phase: Phase = 'build';
  /** Seconds until the next wave starts on its own; 0 means waiting for the player. */
  countdown = 0;
  speed = 1;
  paused = false;
  selected: Tower | null = null;
  placement!: PlacementController;
  /** The shortcut on this map, if any (switched-off shortcuts are null). */
  shortcut: ShortcutDef | null = null;
  shortcutOpen = false;
  /** Seconds until each spell is ready again. */
  spellCooldown: Record<SpellKey, number> = { meteor: 0, freeze: 0 };
  /** True while the player is choosing where to drop a meteor. */
  aimingMeteor = false;
  /** True when the last tap or click came from a finger, so the HUD shows tap hints. */
  touchMode = isTouchDevice();
  /** Lives lost to each enemy type this game (for balance testing). */
  leaks: Partial<Record<EnemyKey, number>> = {};

  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];
  private towerAt = new Map<string, Tower>();
  private grid!: TileType[][];
  private routes!: { main: Point[]; shortcut: Point[] | null; air: Point[] };
  private gates: Phaser.GameObjects.Image[] = [];
  private pendingMeteors: { x: number; y: number; t: number; damage: number }[] = [];
  private seen = new Set<EnemyKey>();
  private aimPos: Point | null = null;
  private mapCam!: MapCamera;
  private bars!: Phaser.GameObjects.Graphics;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private callout: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Game');
  }

  create(data?: GameData): void {
    // The scene object is reused on restart, so reset everything here.
    // Creator levels set their own gold and lives and play by Normal rules.
    this.custom = data?.custom ?? null;
    this.mapMode = data?.map ?? loadMapMode();
    this.seed = data?.seed ?? randomSeed();
    this.level = this.custom
      ? toLevelDef(this.custom)
      : this.mapMode === 'classic'
        ? BUILTIN_LEVEL
        : randomLevel(this.seed);
    this.difficulty = DIFFICULTIES[this.custom ? 'normal' : (data?.difficulty ?? loadDifficulty())];
    this.towerDefs = levelTowers(this.level);
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.towerAt = new Map();
    this.selected = null;
    this.phase = 'build';
    this.countdown = 0;
    this.speed = 1;
    this.paused = false;
    this.shortcutOpen = false;
    this.spellCooldown = { meteor: 0, freeze: 0 };
    this.aimingMeteor = false;
    this.touchMode = isTouchDevice();
    this.leaks = {};
    this.pendingMeteors = [];
    this.seen = new Set();
    this.aimPos = null;
    this.gates = [];
    this.callout = [];

    const { level } = this;
    this.shortcut = level.shortcut && loadShortcutEnabled() && this.difficulty.shortcutChance > 0 ? level.shortcut : null;
    this.grid = buildGrid(level.path, level.decorations);
    this.routes = this.buildRoutes(level);
    if (this.shortcut) for (const [c, r] of this.shortcut.tiles) this.grid[r][c] = 'shortcut';
    renderMap(this, this.grid, level.path, level.decorations);
    this.placeGates();

    this.economy = new Economy(
      level.startMoney ?? this.difficulty.startMoney,
      level.startLives ?? this.difficulty.startLives,
    );
    this.waves = new WaveManager(level.waves, this.difficulty.countMult);
    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.rangeGfx = this.add.graphics().setDepth(DEPTH.range);
    this.placement = new PlacementController(this);

    this.input.mouse?.disableContextMenu();
    this.mapCam = new MapCamera(this);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));

    const kb = this.input.keyboard;
    if (kb) {
      ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((k, i) =>
        kb.on(`keydown-${k}`, () => TOWER_ORDER[i] && this.beginPlacement(TOWER_ORDER[i])),
      );
      kb.on('keydown-ESC', () => this.cancelAll());
      kb.on('keydown-SPACE', () => this.startNextWave());
      kb.on('keydown-U', () => this.upgradeSelected());
      kb.on('keydown-S', () => this.sellSelected());
      kb.on('keydown-T', () => this.cycleTargetSelected());
      kb.on('keydown-Q', () => this.castSpell('meteor'));
      kb.on('keydown-W', () => this.castSpell('freeze'));
      kb.on('keydown-F', () => this.toggleSpeed());
      kb.on('keydown-P', () => this.togglePause());
    }

    this.scene.launch('UI');
    const intro = this.custom ? `${level.name}\n\nBUILD YOUR\nDEFENCES` : 'BUILD YOUR\nDEFENCES';
    banner(this, MAP_W / 2, MAP_H / 2, intro, '#ffcd75');

    if (import.meta.env.DEV) (window as unknown as { gameScene: GameScene }).gameScene = this;
  }

  // ---------- Public actions (UI buttons and hotkeys) ----------

  isUnlocked(key: TowerKey): boolean {
    const wave = this.towerDefs[key].unlockWave;
    return wave === undefined || this.waves.current >= wave;
  }

  beginPlacement(type: TowerKey): void {
    if (this.isOver || !this.isUnlocked(type)) return;
    this.aimingMeteor = false;
    if (this.placement.type === type) {
      this.placement.cancel();
      return;
    }
    this.selected = null;
    // A finger has no hover, so the preview waits for the first tap instead of sitting on the last one.
    if (this.touchMode) this.placement.setHover(null);
    this.placement.begin(type);
  }

  /** True while the player is placing a tower or aiming the meteor, which the HUD CANCEL button stops. */
  get isChoosing(): boolean {
    return this.placement.type !== null || this.aimingMeteor;
  }

  cancelAll(): void {
    this.placement.cancel();
    this.selected = null;
    this.aimingMeteor = false;
  }

  startNextWave(): void {
    if (this.phase !== 'build' || !this.waves.hasNext) return;
    const early = Math.ceil(this.countdown);
    if (early > 0) {
      this.economy.earn(early);
      floatText(this, MAP_W / 2, MAP_H / 2 + 28, `EARLY +${early}`);
    }
    this.countdown = 0;
    this.phase = 'wave';
    this.waves.startNext();
    const n = this.waves.current;
    const unlocked = TOWER_ORDER.filter((k) => this.towerDefs[k].unlockWave === n).map((k) => this.towerDefs[k].name);
    const lines = [`WAVE ${n}`, ...unlocked.map((name) => `${name.toUpperCase()} UNLOCKED!`)];
    banner(this, MAP_W / 2, MAP_H / 2, lines.join('\n'), unlocked.length ? '#73eff7' : '#f4f4f4');
    if (this.shortcut && !this.shortcutOpen && n >= SHORTCUT.opensOnWave) this.openShortcut();
  }

  upgradeSelected(): void {
    const t = this.selected;
    if (!t || this.isOver) return;
    const cost = t.upgradeCost;
    if (cost === null || !this.economy.spend(cost)) return;
    t.upgrade();
    burst(this, t.x, t.y, 0xffcd75, 10, 20);
    floatText(this, t.x, t.y - 16, 'UPGRADE!', '#a7f070');
  }

  sellSelected(): void {
    const t = this.selected;
    if (!t || this.isOver) return;
    const value = t.sellValue;
    this.economy.earn(value);
    this.towerAt.delete(this.cellKey(t.col, t.row));
    this.towers = this.towers.filter((x) => x !== t);
    t.destroy();
    burst(this, t.x, t.y, 0xc69060, 12, 18);
    floatText(this, t.x, t.y - 8, `+${value}`);
    this.selected = null;
  }

  cycleTargetSelected(): void {
    this.selected?.cycleTarget();
  }

  spellReady(key: SpellKey): boolean {
    return this.spellCooldown[key] <= 0 && !this.isOver;
  }

  /** Freeze goes off at once; Meteor waits for a click on the map. */
  castSpell(key: SpellKey): void {
    if (!this.spellReady(key)) return;
    if (key === 'meteor') {
      this.aimingMeteor = !this.aimingMeteor;
      if (this.aimingMeteor) {
        this.placement.cancel();
        this.selected = null;
        if (this.touchMode) this.aimPos = null;
      }
      return;
    }
    this.spellCooldown.freeze = SPELLS.freeze.cooldown;
    for (const e of this.enemies) e.freeze(FREEZE.duration);
    if (fx.enabled) this.cameras.main.flash(250, 160, 230, 255);
    banner(this, MAP_W / 2, MAP_H / 2, 'FREEZE!', '#73eff7');
  }

  /** Drops a meteor at a point on the map (used by clicks and the test autoplayer). */
  dropMeteor(x: number, y: number): void {
    if (!this.spellReady('meteor')) return;
    this.aimingMeteor = false;
    this.spellCooldown.meteor = SPELLS.meteor.cooldown;
    this.pendingMeteors.push({ x, y, t: METEOR.fallTime, damage: METEOR.damage(Math.max(1, this.waves.current)) });
    meteorFall(this, x, y, METEOR.radius, METEOR.fallTime / this.speed);
  }

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
  }

  togglePause(): void {
    if (!this.isOver) this.paused = !this.paused;
  }

  /** Leaves the level: back to the Creator for its levels, else the title screen. */
  quit(): void {
    this.scene.stop('UI');
    if (this.custom) this.scene.start('Editor', { level: this.custom });
    else this.scene.start('Menu');
  }

  get isOver(): boolean {
    return this.phase === 'won' || this.phase === 'lost';
  }

  get enemiesAlive(): number {
    return this.enemies.length;
  }

  /** What the next wave (or the current one before it starts) will send. */
  nextWavePreview(): { wave: number; items: { enemy: EnemyKey; count: number }[] } | null {
    const index = this.phase === 'wave' ? this.waves.current : Math.max(this.waves.current, 0);
    const wave = this.level.waves[index];
    if (!wave) return null;
    return { wave: index + 1, items: waveSummary(wave, this.difficulty.countMult) };
  }

  /** Read-only views for the HUD and the test autoplayer. */
  get allEnemies(): readonly Enemy[] {
    return this.enemies;
  }

  get allTowers(): readonly Tower[] {
    return this.towers;
  }

  get mainRoute(): Point[] {
    return this.routes.main;
  }

  get shortcutRoute(): Point[] | null {
    return this.routes.shortcut;
  }

  // ---------- Main loop ----------

  update(_time: number, delta: number): void {
    this.drawRanges();
    if (this.isOver || this.paused) {
      this.drawBars();
      return;
    }
    const dt = (Math.min(delta, 100) / 1000) * this.speed;

    if (this.phase === 'build' && this.countdown > 0) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.startNextWave();
      }
    }
    if (this.phase === 'wave') {
      for (const k of Object.keys(this.spellCooldown) as SpellKey[]) {
        this.spellCooldown[k] = Math.max(0, this.spellCooldown[k] - dt);
      }
    }

    this.waves.update(dt, (key) => this.spawnEnemy(key));
    for (const e of this.enemies) e.step(dt);
    this.shamansHeal(dt);
    this.landMeteors(dt);

    for (const p of this.projectiles) {
      if (p.step(dt)) this.impact(p);
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.done) p.destroy();
      return !p.done;
    });

    this.cleanupEnemies();

    for (const t of this.towers) {
      const target = t.update(dt, this.enemies);
      if (target) this.fire(t, target);
    }

    this.drawBars();

    if (this.economy.lives <= 0) {
      this.endGame(false);
    } else if (this.phase === 'wave' && !this.waves.spawning && this.enemies.length === 0) {
      this.waveCleared();
    }
  }

  // ---------- Internals ----------

  /** Main route, shortcut route (main path cut across the bend) and the flyers' straight line. */
  private buildRoutes(level: LevelDef): { main: Point[]; shortcut: Point[] | null; air: Point[] } {
    const main = pathPoints(level.path);
    const air = [main[0], main[main.length - 1]];
    let shortcut: Point[] | null = null;
    if (this.shortcut) {
      const tiles = expandCorners(level.path);
      const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
      const i = tiles.findIndex((t) => same(t, this.shortcut!.from));
      const j = tiles.findIndex((t) => same(t, this.shortcut!.to));
      if (i >= 0 && j > i) {
        shortcut = pathPoints(tilesToCorners([...tiles.slice(0, i + 1), ...this.shortcut.tiles, ...tiles.slice(j)]));
      } else {
        this.shortcut = null;
      }
    }
    return { main, shortcut, air };
  }

  /** Barricades at both ends of the shortcut until it opens. */
  private placeGates(): void {
    if (!this.shortcut) return;
    const ends = [this.shortcut.tiles[0], this.shortcut.tiles[this.shortcut.tiles.length - 1]];
    for (const [c, r] of ends) {
      const { x, y } = tileCenter(c, r);
      this.gates.push(this.add.image(x, y, 'gate').setDepth(DEPTH.towerBase));
    }
  }

  private openShortcut(): void {
    this.shortcutOpen = true;
    for (const g of this.gates) {
      burst(this, g.x, g.y, 0xc69060, 14, 22);
      g.destroy();
    }
    this.gates = [];
    const mid = this.shortcut!.tiles[Math.floor(this.shortcut!.tiles.length / 2)];
    const { x, y } = tileCenter(mid[0], mid[1]);
    floatText(this, x, y - 12, 'SHORTCUT OPEN!', '#ef7d57');
  }

  spawnEnemy(key: EnemyKey): void {
    const def = ENEMIES[key];
    let route = this.routes.main;
    if (def.flying) route = this.routes.air;
    else if (this.shortcutOpen && this.routes.shortcut && Math.random() < this.difficulty.shortcutChance) {
      route = this.routes.shortcut;
    }
    const hp = enemyHpMultiplier(this.difficulty, this.waves.current);
    this.enemies.push(new Enemy(this, def, route, hp, this.difficulty.speedMult));
    if (!this.seen.has(key) && !BASIC_ENEMIES.includes(key)) {
      this.seen.add(key);
      this.announce(key);
    }
  }

  /** A card at the top of the map introducing an enemy the player hasn't met yet. */
  private announce(key: EnemyKey): void {
    if (!fx.enabled) return;
    for (const o of this.callout) o.destroy();
    const def = ENEMIES[key];
    const w = 380;
    const x = MAP_W / 2 - w / 2;
    const y = 8;
    const g = this.add.graphics().setDepth(DEPTH.banner);
    g.fillStyle(0x1a1c2c, 0.92).fillRect(x, y, w, 44);
    g.lineStyle(2, def.boss ? 0xb13e53 : 0x73eff7, 1).strokeRect(x + 1, y + 1, w - 2, 42);
    const icon = this.add.image(x + 24, y + 22, `${def.texture}_0`).setDepth(DEPTH.banner);
    const title = this.add
      .text(x + 46, y + 8, `${def.boss ? 'BOSS' : 'NEW ENEMY'}: ${def.name.toUpperCase()}`, {
        fontFamily: FONT,
        fontSize: '8px',
        color: def.boss ? '#ef7d57' : '#73eff7',
      })
      .setDepth(DEPTH.banner);
    const tip = this.add
      .text(x + 46, y + 22, def.tip, { fontFamily: FONT, fontSize: '8px', color: '#f4f4f4', wordWrap: { width: w - 56 } })
      .setDepth(DEPTH.banner)
      .setLineSpacing(3);
    this.callout = [g, icon, title, tip];
    this.tweens.add({
      targets: this.callout,
      alpha: 0,
      delay: 5000,
      duration: 500,
      onComplete: () => this.callout.forEach((o) => o.destroy()),
    });
  }

  private shamansHeal(dt: number): void {
    for (const s of this.enemies) {
      const heal = s.def.heal;
      if (!heal || !s.targetable) continue;
      s.healTimer -= dt;
      if (s.healTimer > 0) continue;
      s.healTimer = heal.interval;
      const amount = Math.round(heal.amount * s.hpMultiplier);
      let healed = false;
      for (const e of this.enemies) {
        if (!e.targetable || e.hp >= e.maxHp) continue;
        if (Math.hypot(e.pos.x - s.pos.x, e.pos.y - s.pos.y) > heal.radius) continue;
        e.heal(amount);
        healSparkle(this, e.pos.x, e.aimY);
        healed = true;
      }
      if (healed) ring(this, s.pos.x, s.pos.y, heal.radius, 0xa7f070);
    }
  }

  private landMeteors(dt: number): void {
    for (const m of this.pendingMeteors) {
      m.t -= dt;
      if (m.t > 0) continue;
      for (const e of this.enemies) {
        if (e.targetable && !e.flying && Math.hypot(e.pos.x - m.x, e.pos.y - m.y) <= METEOR.radius) e.hit(m.damage, true);
      }
      meteorImpact(this, m.x, m.y, METEOR.radius);
    }
    this.pendingMeteors = this.pendingMeteors.filter((m) => m.t > 0);
  }

  private fire(tower: Tower, target: Enemy): void {
    if (tower.def.instant) {
      this.zap(tower, target);
      return;
    }
    const m = tower.muzzle();
    this.projectiles.push(
      new Projectile(this, m.x, m.y, tower.def.projectileTexture, tower.def.key, tower.stats, target, tower.def.pierce),
    );
  }

  /** Lightning: hits the target, then jumps to the nearest enemies not yet hit, weakening each jump. */
  private zap(tower: Tower, first: Enemy): void {
    const { damage, chain } = tower.stats;
    const hit: Enemy[] = [first];
    let current = first;
    while (chain && hit.length < chain.count) {
      let next: Enemy | null = null;
      let best = chain.range;
      for (const e of this.enemies) {
        if (!e.targetable || hit.includes(e)) continue;
        const d = Math.hypot(e.pos.x - current.pos.x, e.pos.y - current.pos.y);
        if (d <= best) {
          best = d;
          next = e;
        }
      }
      if (!next) break;
      hit.push(next);
      current = next;
    }
    hit.forEach((e, i) => e.hit(Math.max(1, Math.round(damage * Math.pow(0.85, i))), tower.def.pierce));
    lightningBolt(this, [{ x: tower.x, y: tower.y - 8 }, ...hit.map((e) => ({ x: e.pos.x, y: e.aimY }))]);
  }

  private impact(p: Projectile): void {
    const { stats } = p;
    const victims =
      stats.splash > 0
        ? this.enemies.filter(
            (e) => e.targetable && !e.flying && Math.hypot(e.pos.x - p.tx, e.pos.y - p.ty) <= stats.splash,
          )
        : p.target.targetable
          ? [p.target]
          : [];
    for (const e of victims) {
      e.hit(stats.damage, p.pierce);
      if (stats.slow) e.slow(stats.slow.factor, stats.slow.duration);
    }
    if (p.kind === 'cannon') {
      ring(this, p.tx, p.ty, stats.splash, 0xef7d57);
      burst(this, p.tx, p.ty, 0x566c86, 6, 12);
    } else if (p.kind === 'frost') {
      ring(this, p.tx, p.ty, Math.max(stats.splash, 12), 0x73eff7);
    } else if (p.kind === 'ballista') {
      burst(this, p.tx, p.ty, 0xf4f4f4, 6, 10);
    }
  }

  private cleanupEnemies(): void {
    const castle = tileCenter(...this.level.path[this.level.path.length - 1]);
    this.enemies = this.enemies.filter((e) => {
      if (e.dead) {
        const reward = killReward(this.difficulty, e.def.reward);
        this.economy.earn(reward);
        burst(this, e.pos.x, e.aimY, e.def.color, e.def.boss ? 30 : 10, e.def.boss ? 36 : 18);
        floatText(this, e.pos.x, e.aimY - 10, `+${reward}`);
        if (e.def.boss) banner(this, MAP_W / 2, MAP_H / 2, `${e.def.name.toUpperCase()}\nDEFEATED!`, '#ffcd75');
        e.destroy();
        return false;
      }
      if (e.escaped) {
        this.economy.loseLives(e.def.livesCost);
        this.leaks[e.def.key] = (this.leaks[e.def.key] ?? 0) + e.def.livesCost;
        if (fx.enabled) this.cameras.main.shake(e.def.boss ? 400 : 120, e.def.boss ? 0.012 : 0.004);
        floatText(this, castle.x - 8, castle.y - 18, `-${e.def.livesCost}`, '#b13e53');
        e.destroy();
        return false;
      }
      return true;
    });
  }

  private waveCleared(): void {
    const n = this.waves.current;
    const bonus = waveClearBonus(n);
    this.economy.earn(bonus);
    if (!this.waves.hasNext) {
      this.endGame(true);
      return;
    }
    this.phase = 'build';
    this.countdown = BETWEEN_WAVES;
    banner(this, MAP_W / 2, MAP_H / 2, `WAVE ${n} CLEAR\n+${bonus} GOLD`, '#a7f070');
  }

  private endGame(won: boolean): void {
    this.phase = won ? 'won' : 'lost';
    this.placement.cancel();
    this.selected = null;
    this.aimingMeteor = false;
    this.time.delayedCall(won ? 1200 : 600, () => {
      this.scene.pause('UI');
      this.scene.launch('GameOver', {
        won,
        wave: this.waves.current,
        lives: this.economy.lives,
        difficulty: this.difficulty.key,
        custom: this.custom ?? undefined,
        seed: this.seed,
        map: this.mapMode,
      });
      this.scene.pause();
    });
  }

  private cellKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  /** The map point under a pointer, allowing for zoom; null when the pointer is over the HUD. */
  private toWorld(p: Phaser.Input.Pointer): Point | null {
    if (p.x < 0 || p.x >= MAP_W || p.y < 0 || p.y >= MAP_H) return null;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  private cellAt(p: Phaser.Input.Pointer): { col: number; row: number } | null {
    const w = this.toWorld(p);
    if (!w) return null;
    const col = Math.floor(w.x / TILE);
    const row = Math.floor(w.y / TILE);
    return col >= 0 && col < COLS && row >= 0 && row < ROWS ? { col, row } : null;
  }

  isBuildable(col: number, row: number): boolean {
    return (
      col >= 0 && col < COLS && row >= 0 && row < ROWS &&
      this.grid[row][col] === 'grass' &&
      !this.towerAt.has(this.cellKey(col, row))
    );
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    // Zoomed in, a finger drags the map around (and pinching zooms).
    if (p.wasTouch && this.mapCam.move(p)) return;
    // A finger only moves the preview while it is dragging on the map; it never leaves it on the HUD.
    if (p.wasTouch && (!p.isDown || !this.cellAt(p))) return;
    this.placement.setHover(this.cellAt(p));
    this.aimPos = this.toWorld(p);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    this.touchMode = p.wasTouch;
    if (p.x >= MAP_W) return; // the HUD is handled by the UI scene
    // Fingers act when lifted, so a drag or pinch never builds by accident. The mouse acts at once.
    if (p.wasTouch) this.mapCam.down(p);
    else this.handleTap(p);
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    const tap = this.mapCam.up(p);
    if (tap && p.x < MAP_W) this.handleTap(p);
  }

  private handleTap(p: Phaser.Input.Pointer): void {
    if (this.isOver) return;
    const world = this.toWorld(p);
    const cell = this.cellAt(p);
    if (!cell) return; // clicks on the HUD panel are handled by the UI scene
    if (p.rightButtonDown()) {
      this.cancelAll();
      return;
    }
    if (this.aimingMeteor) {
      // Touch: the first tap aims, a second tap inside the circle drops it.
      if (!world) return;
      if (p.wasTouch && !this.isNearAim(world.x, world.y)) {
        this.aimPos = world;
        return;
      }
      const at = p.wasTouch && this.aimPos ? this.aimPos : world;
      this.dropMeteor(at.x, at.y);
      return;
    }
    if (this.placement.type) {
      // Touch: the first tap on a tile shows the tower and its range, a second tap on the same tile builds.
      const hover = this.placement.hover;
      if (p.wasTouch && (!hover || hover.col !== cell.col || hover.row !== cell.row)) {
        this.placement.setHover(cell);
        return;
      }
      const placed = this.tryPlace(this.placement.type, cell.col, cell.row);
      const keepPlacing = !p.wasTouch && (p.event as MouseEvent).shiftKey;
      if (placed && !keepPlacing) this.placement.cancel();
      return;
    }
    this.selected = this.towerAt.get(this.cellKey(cell.col, cell.row)) ?? null;
  }

  private isNearAim(x: number, y: number): boolean {
    return this.aimPos !== null && Math.hypot(x - this.aimPos.x, y - this.aimPos.y) <= METEOR.radius;
  }

  /** Builds a tower if the tile is free and the player can pay. */
  tryPlace(type: TowerKey, col: number, row: number): boolean {
    const def = this.towerDefs[type];
    const { x, y } = tileCenter(col, row);
    if (!this.isUnlocked(type)) return false;
    if (!this.isBuildable(col, row)) {
      floatText(this, x, y - 12, "CAN'T BUILD", '#b13e53');
      return false;
    }
    if (!this.economy.spend(def.cost)) {
      floatText(this, x, y - 12, 'NEED GOLD', '#b13e53');
      return false;
    }
    const tower = new Tower(this, def, col, row);
    this.towers.push(tower);
    this.towerAt.set(this.cellKey(col, row), tower);
    burst(this, x, y + 8, 0xc69060, 8, 14);
    return true;
  }

  private drawRanges(): void {
    const g = this.rangeGfx;
    g.clear();
    const { type, hover } = this.placement;
    if (this.aimingMeteor && this.aimPos) {
      g.fillStyle(0xef7d57, 0.15).fillCircle(this.aimPos.x, this.aimPos.y, METEOR.radius);
      g.lineStyle(2, 0xef7d57, 0.9).strokeCircle(this.aimPos.x, this.aimPos.y, METEOR.radius);
    } else if (type && hover) {
      const def = this.towerDefs[type];
      const ok = this.isBuildable(hover.col, hover.row) && this.economy.canAfford(def.cost);
      this.placement.setValid(ok);
      const color = ok ? 0xa7f070 : 0xb13e53;
      const { x, y } = tileCenter(hover.col, hover.row);
      g.fillStyle(color, 0.12).fillCircle(x, y, def.levels[0].range);
      g.lineStyle(2, color, 0.7).strokeCircle(x, y, def.levels[0].range);
      g.lineStyle(2, color, 0.9).strokeRect(hover.col * TILE + 1, hover.row * TILE + 1, TILE - 2, TILE - 2);
    } else if (this.selected) {
      const t = this.selected;
      g.fillStyle(0xf4f4f4, 0.08).fillCircle(t.x, t.y, t.stats.range);
      g.lineStyle(2, 0xf4f4f4, 0.5).strokeCircle(t.x, t.y, t.stats.range);
      g.lineStyle(2, 0xffcd75, 1).strokeRect(t.col * TILE + 1, t.row * TILE + 1, TILE - 2, TILE - 2);
    }
  }

  private drawBars(): void {
    const g = this.bars;
    g.clear();
    for (const e of this.enemies) {
      if (e.hp >= e.maxHp) continue;
      const scale = e.def.scale ?? 1;
      const w = Math.round(20 * scale);
      const x = Math.round(e.pos.x - w / 2);
      const y = Math.round(e.aimY - 18 * scale);
      const frac = e.hp / e.maxHp;
      g.fillStyle(0x1a1c2c, 1).fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(0xb13e53, 1).fillRect(x, y, w, 3);
      g.fillStyle(frac > 0.5 ? 0xa7f070 : frac > 0.25 ? 0xffcd75 : 0xef7d57, 1).fillRect(x, y, Math.ceil(w * frac), 3);
      if (e.def.armor) g.fillStyle(0x94b0c2, 1).fillRect(x - 1, y + 4, w + 2, 1);
    }
  }
}
