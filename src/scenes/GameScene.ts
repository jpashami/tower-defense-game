import Phaser from 'phaser';
import { BETWEEN_WAVES, DEPTH, FONT, MAP_H, MAP_W, TILE } from '../config/constants';
import { DIFFICULTIES, enemyHpMultiplier, killReward, loadDifficulty, type DifficultyDef, type DifficultyKey } from '../config/difficulty';
import type { EnemyAction, EnemyDef } from '../config/enemies';
import { levelTowers, type LevelDef } from '../config/level';
import { buildGrid, expandCorners, isTrapTile, pathPoints, tileCenter, tilesToCorners, type Point, type TileType } from '../config/map';
import { loadMapMode, loadShortcutEnabled, type MapMode } from '../config/settings';
import { SHORTCUT } from '../config/shortcut';
import { FREEZE, METEOR, SPELLS, type SpellKey } from '../config/spells';
import type { TowerDef } from '../config/towers';
import type { TrapDef } from '../config/traps';
import { waveClearBonus, waveSummary } from '../config/waves';
import { toLevelDef, type CustomLevel } from '../editor/customLevel';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Tower } from '../entities/Tower';
import { Trap } from '../entities/Trap';
import { Economy } from '../systems/Economy';
import { banner, burst, floatText, fx, healSparkle, lightningBolt, meteorFall, meteorImpact, puff, ring, strike } from '../systems/Effects';
import { MapCamera } from '../systems/MapCamera';
import { randomSeed, type ShortcutDef } from '../systems/MapGenerator';
import { renderMap } from '../systems/MapRenderer';
import { PlacementController } from '../systems/PlacementController';
import { WaveManager } from '../systems/WaveManager';
import { isTouchDevice } from '../ui/touch';
import { DEFAULT_CONTENT, difficultyFor, type GameContent } from '../version/compile';
import { levelForContent } from '../version/levels';
import { activeContent } from '../version/registry';
import { ensureVersionTextures } from '../version/textures';

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

/** Split and summoned enemies stop making more after this many generations. */
const MAX_GENERATION = 3;
/** No more splitting or summoning once this many enemies are on the map. */
const MAX_ENEMIES = 250;
/** Seconds between "on hit" abilities going off for one enemy. */
const HIT_COOLDOWN = 1;

interface Cloud {
  x: number;
  y: number;
  radius: number;
  dps: number;
  t: number;
}

/**
 * The battlefield. Owns all game state; the UI scene reads it every frame
 * and calls the public methods below in response to button presses.
 */
export class GameScene extends Phaser.Scene {
  economy!: Economy;
  waves!: WaveManager;
  difficulty!: DifficultyDef;
  level!: LevelDef;
  /** The default game, or the player's family version. */
  content: GameContent = DEFAULT_CONTENT;
  /** Set when playing a Creator level, so the player can go back to editing it. */
  custom: CustomLevel | null = null;
  mapMode: MapMode = 'random';
  seed = 0;
  cols = 20;
  rows = 15;
  /** Tower stats for this level, after any Creator tuning. */
  towerDefs!: Record<string, TowerDef>;
  /** Shop order of towers, then traps. */
  towerOrder: string[] = [];
  trapOrder: string[] = [];
  phase: Phase = 'build';
  /** Seconds until the next wave starts on its own; 0 means waiting for the player. */
  countdown = 0;
  speed = 1;
  paused = false;
  selected: Tower | null = null;
  selectedTrap: Trap | null = null;
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
  leaks: Partial<Record<string, number>> = {};

  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private traps: Trap[] = [];
  private projectiles: Projectile[] = [];
  private clouds: Cloud[] = [];
  private towerAt = new Map<string, Tower>();
  private trapAt = new Map<string, Trap>();
  private grid!: TileType[][];
  private routes!: { ground: Point[][]; shortcut: Point[] | null; air: Point[][]; boat: Point[] | null };
  /** Squares where enemies enter or the castle stands; no traps there. */
  private ends = new Set<string>();
  private spawned = 0;
  private gates: Phaser.GameObjects.Image[] = [];
  private pendingMeteors: { x: number; y: number; t: number; damage: number }[] = [];
  private seen = new Set<string>();
  private aimPos: Point | null = null;
  private mapCam!: MapCamera;
  private bars!: Phaser.GameObjects.Graphics;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private cloudGfx!: Phaser.GameObjects.Graphics;
  private callout: Phaser.GameObjects.GameObject[] = [];
  /** The last mouse press was already handled when it went down. */
  private mouseActed = false;

  constructor() {
    super('Game');
  }

  create(data?: GameData): void {
    // The scene object is reused on restart, so reset everything here.
    // Creator levels use the original towers and enemies, Normal rules, and their own gold and lives.
    this.custom = data?.custom ?? null;
    this.content = this.custom ? DEFAULT_CONTENT : activeContent();
    ensureVersionTextures(this, this.content);
    this.mapMode = data?.map ?? loadMapMode();
    this.seed = data?.seed ?? randomSeed();
    this.level = this.custom ? toLevelDef(this.custom) : levelForContent(this.content, this.seed, this.mapMode, loadShortcutEnabled());
    this.difficulty = this.custom ? DIFFICULTIES.normal : difficultyFor(data?.difficulty ?? loadDifficulty(), this.content.rules);
    this.towerDefs = this.custom ? levelTowers(this.level) : this.content.towers;
    this.towerOrder = this.content.towerOrder;
    this.trapOrder = this.content.trapOrder;
    this.cols = this.level.cols ?? 20;
    this.rows = this.level.rows ?? 15;
    this.enemies = [];
    this.towers = [];
    this.traps = [];
    this.projectiles = [];
    this.clouds = [];
    this.towerAt = new Map();
    this.trapAt = new Map();
    this.selected = null;
    this.selectedTrap = null;
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
    this.spawned = 0;

    const { level } = this;
    this.shortcut = level.shortcut && this.difficulty.shortcutChance > 0 ? level.shortcut : null;
    this.grid = buildGrid(level.path, level.decorations, {
      cols: this.cols,
      rows: this.rows,
      extraPaths: level.extraPaths,
      terrain: level.terrain,
    });
    this.routes = this.buildRoutes(level);
    if (this.shortcut) for (const [c, r] of this.shortcut.tiles) this.grid[r][c] = 'shortcut';
    this.ends = new Set([level.path, ...(level.extraPaths ?? [])].flatMap((p) => [p[0], p[p.length - 1]]).map(([c, r]) => this.cellKey(c, r)));
    renderMap(this, this.grid, level.path, level.decorations, { extraPaths: level.extraPaths, boatRoute: level.boatRoute });
    this.placeGates();

    this.economy = new Economy(level.startMoney ?? this.difficulty.startMoney, level.startLives ?? this.difficulty.startLives);
    this.waves = new WaveManager(level.waves, this.difficulty.countMult);
    this.cloudGfx = this.add.graphics().setDepth(DEPTH.deco + 0.3);
    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.rangeGfx = this.add.graphics().setDepth(DEPTH.range);
    this.placement = new PlacementController(this);

    this.input.mouse?.disableContextMenu();
    this.mapCam = new MapCamera(this, this.cols * TILE, this.rows * TILE);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));

    const kb = this.input.keyboard;
    if (kb) {
      ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.pickShopItem(i)));
      kb.on('keydown-ESC', () => this.cancelAll());
      kb.on('keydown-SPACE', () => this.startNextWave());
      kb.on('keydown-U', () => this.upgradeSelected());
      kb.on('keydown-S', () => this.sellSelected());
      kb.on('keydown-T', () => this.cycleTargetSelected());
      kb.on('keydown-R', () => this.repairSelected());
      kb.on('keydown-Q', () => this.castSpell('meteor'));
      kb.on('keydown-W', () => this.castSpell('freeze'));
      kb.on('keydown-F', () => this.toggleSpeed());
      kb.on('keydown-P', () => this.togglePause());
    }

    this.scene.launch('UI');
    const title = this.custom ? level.name : this.content.version ? this.content.name : '';
    // The view starts fitted to the whole map, so its middle is the map's middle.
    const middle = this.cols * TILE > MAP_W || this.rows * TILE > MAP_H ? { x: (this.cols * TILE) / 2, y: (this.rows * TILE) / 2 } : { x: MAP_W / 2, y: MAP_H / 2 };
    banner(this, middle.x, middle.y, title ? `${title}\n\nBUILD YOUR\nDEFENCES` : 'BUILD YOUR\nDEFENCES', '#ffcd75');

    if (import.meta.env.DEV) (window as unknown as { gameScene: GameScene }).gameScene = this;
  }

  // ---------- Public actions (UI buttons and hotkeys) ----------

  /** Shop slot i: the towers first, then the traps. */
  pickShopItem(i: number): void {
    const tower = this.towerOrder[i];
    if (tower) this.beginPlacement(tower);
    else if (this.trapOrder[i - this.towerOrder.length]) this.beginTrap(this.trapOrder[i - this.towerOrder.length]);
  }

  isUnlocked(key: string): boolean {
    const wave = this.towerDefs[key]?.unlockWave;
    return wave === undefined || this.waves.current >= wave;
  }

  beginPlacement(type: string): void {
    const def = this.towerDefs[type];
    if (this.isOver || !def || !this.isUnlocked(type)) return;
    this.aimingMeteor = false;
    if (this.placement.type === type) {
      this.placement.cancel();
      return;
    }
    this.selected = null;
    this.selectedTrap = null;
    // A finger has no hover, so the preview waits for the first tap instead of sitting on the last one.
    if (this.touchMode) this.placement.setHover(null);
    this.placement.begin(def);
  }

  beginTrap(type: string): void {
    const def = this.content.traps[type];
    if (this.isOver || !def) return;
    this.aimingMeteor = false;
    if (this.placement.type === type) {
      this.placement.cancel();
      return;
    }
    this.selected = null;
    this.selectedTrap = null;
    if (this.touchMode) this.placement.setHover(null);
    this.placement.beginTrap(def);
  }

  /** How many of a trap are on the map. */
  trapCount(key: string): number {
    return this.traps.filter((t) => t.def.key === key).length;
  }

  /** True while the player is placing a tower or aiming the meteor, which the HUD CANCEL button stops. */
  get isChoosing(): boolean {
    return this.placement.type !== null || this.aimingMeteor;
  }

  cancelAll(): void {
    this.placement.cancel();
    this.selected = null;
    this.selectedTrap = null;
    this.aimingMeteor = false;
  }

  startNextWave(): void {
    if (this.phase !== 'build' || !this.waves.hasNext) return;
    const early = Math.ceil(this.countdown);
    if (early > 0) {
      this.economy.earn(early);
      floatText(this, this.viewCentre.x, this.viewCentre.y + 28, `EARLY +${early}`);
    }
    this.countdown = 0;
    this.phase = 'wave';
    this.waves.startNext();
    const n = this.waves.current;
    const unlocked = this.towerOrder.filter((k) => this.towerDefs[k].unlockWave === n).map((k) => this.towerDefs[k].name);
    const lines = [`WAVE ${n}`, ...unlocked.map((name) => `${name.toUpperCase()} UNLOCKED!`)];
    this.banner(lines.join('\n'), unlocked.length ? '#73eff7' : '#f4f4f4');
    if (this.shortcut && !this.shortcutOpen && n >= SHORTCUT.opensOnWave) this.openShortcut();
  }

  upgradeSelected(): void {
    const t = this.selected;
    if (!t || this.isOver || t.broken) return;
    const cost = t.upgradeCost;
    if (cost === null || !this.economy.spend(cost)) return;
    t.upgrade();
    burst(this, t.x, t.y, 0xffcd75, 10, 20);
    floatText(this, t.x, t.y - 16, 'UPGRADE!', '#a7f070');
  }

  sellSelected(): void {
    if (this.isOver) return;
    const trap = this.selectedTrap;
    if (trap) {
      this.economy.earn(trap.sellValue);
      floatText(this, trap.x, trap.y - 8, `+${trap.sellValue}`);
      this.removeTrap(trap);
      return;
    }
    const t = this.selected;
    if (!t) return;
    const value = t.sellValue;
    this.economy.earn(value);
    this.towerAt.delete(this.cellKey(t.col, t.row));
    this.towers = this.towers.filter((x) => x !== t);
    t.destroy();
    burst(this, t.x, t.y, 0xc69060, 12, 18);
    floatText(this, t.x, t.y - 8, `+${value}`);
    this.selected = null;
  }

  /** Fixes the selected broken tower, or sets the selected spent bomb again. */
  repairSelected(): void {
    if (this.isOver) return;
    const t = this.selected;
    if (t?.broken && this.economy.spend(t.repairCost)) {
      t.repair();
      burst(this, t.x, t.y, 0xa7f070, 10, 18);
      floatText(this, t.x, t.y - 16, 'FIXED!', '#a7f070');
    }
    const trap = this.selectedTrap;
    if (trap && trap.def.kind === 'bomb' && !trap.armed && this.economy.spend(trap.def.rearm)) {
      trap.setArmed(true);
      trap.spent += trap.def.rearm;
      floatText(this, trap.x, trap.y - 12, 'READY!', '#a7f070');
    }
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
        this.selectedTrap = null;
        if (this.touchMode) this.aimPos = null;
      }
      return;
    }
    this.spellCooldown.freeze = SPELLS.freeze.cooldown;
    for (const e of this.enemies) e.freeze(FREEZE.duration);
    if (fx.enabled) this.cameras.main.flash(250, 160, 230, 255);
    this.banner('FREEZE!', '#73eff7');
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
  nextWavePreview(): { wave: number; items: { enemy: string; count: number }[] } | null {
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
    return this.routes.ground[0];
  }

  get shortcutRoute(): Point[] | null {
    return this.routes.shortcut;
  }

  get boatRoute(): Point[] | null {
    return this.routes.boat;
  }

  /** Routes from any second portal. */
  get extraRoutes(): Point[][] {
    return this.routes.ground.slice(1);
  }

  // ---------- Main loop ----------

  update(_time: number, delta: number): void {
    this.mapCam.update();
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
    this.reveal();
    this.towerAuras();
    for (const e of this.enemies) e.step(dt);
    this.healers(dt);
    this.enemyAbilities(dt);
    this.enemyAttacks(dt);
    this.springTraps();
    this.driftClouds(dt);
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
      const targets = t.update(dt, this.enemies, this.reloadRate(t));
      if (targets) this.fire(t, targets);
    }

    this.drawBars();

    if (this.economy.lives <= 0) {
      this.endGame(false);
    } else if (this.phase === 'wave' && !this.waves.spawning && this.enemies.length === 0) {
      this.waveCleared();
    }
  }

  // ---------- Internals ----------

  /** Ground routes (one per portal), the shortcut, the flyers' straight lines and the boats' river. */
  private buildRoutes(level: LevelDef): { ground: Point[][]; shortcut: Point[] | null; air: Point[][]; boat: Point[] | null } {
    const ground = [level.path, ...(level.extraPaths ?? [])].map((p) => pathPoints(p));
    const air = ground.map((g) => [g[0], g[g.length - 1]]);
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
    const boat = level.boatRoute && level.boatRoute.length > 1 ? pathPoints(level.boatRoute) : null;
    return { ground, shortcut, air, boat };
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

  /** The ground under a map point, for sand, ice and lava. */
  private groundAt = (x: number, y: number): TileType | undefined =>
    this.grid[Math.floor(y / TILE)]?.[Math.floor(x / TILE)];

  spawnEnemy(key: string): void {
    const def = this.content.enemies[key];
    if (!def) return;
    const portal = this.spawned++ % this.routes.ground.length;
    let route = this.routes.ground[portal];
    if (def.flying) route = this.routes.air[portal];
    else if (def.boat && this.routes.boat) route = this.routes.boat;
    else if (portal === 0 && this.shortcutOpen && this.routes.shortcut && Math.random() < this.difficulty.shortcutChance) {
      route = this.routes.shortcut;
    }
    const hp = enemyHpMultiplier(this.difficulty, Math.max(1, this.waves.current));
    this.addEnemy(new Enemy(this, this.asWalker(def), route, hp, this.difficulty.speedMult, { ground: this.groundAt }));
    if (!this.seen.has(key) && !this.content.familiar.has(key)) {
      this.seen.add(key);
      this.announce(def);
    }
  }

  /**
   * Where a split or summoned enemy goes. Flyers head straight for the castle, boats keep to
   * the river, and walkers follow the road; one that can't share its parent's route starts at
   * the nearest point of its own.
   */
  private childRoute(parent: Enemy, child: EnemyDef): { route: Point[]; progress: number; sameRoute: boolean } {
    const parentKind = parent.flying ? 'air' : parent.boat ? 'boat' : 'ground';
    const childKind = child.flying ? 'air' : child.boat ? 'boat' : 'ground';
    if (childKind === parentKind) return { route: parent.route, progress: parent.progress, sameRoute: true };
    if (childKind === 'air') {
      const castle = this.routes.ground[0][this.routes.ground[0].length - 1];
      return { route: [{ x: parent.pos.x, y: parent.pos.y }, castle], progress: 0, sameRoute: false };
    }
    const options = childKind === 'boat' && this.routes.boat ? [this.routes.boat] : this.routes.ground;
    let best = { route: options[0], progress: 0, d: Infinity };
    for (const route of options) {
      const near = nearestOnRoute(route, parent.pos);
      if (near.d < best.d) best = { route, ...near };
    }
    return { route: best.route, progress: best.progress, sameRoute: false };
  }

  /** Boats with no river to sail walk the road instead. */
  private asWalker(def: EnemyDef): EnemyDef {
    return def.boat && !this.routes.boat ? { ...def, boat: false } : def;
  }

  private addEnemy(e: Enemy): void {
    this.enemies.push(e);
    this.fireTriggers(e, 'spawn');
  }

  /** A card at the top of the map introducing an enemy the player hasn't met yet. */
  private announce(def: EnemyDef): void {
    if (!fx.enabled) return;
    for (const o of this.callout) o.destroy();
    const w = 380;
    const x = MAP_W / 2 - w / 2;
    const y = 8;
    const g = this.add.graphics().setDepth(DEPTH.banner).setScrollFactor(0);
    g.fillStyle(0x1a1c2c, 0.92).fillRect(x, y, w, 44);
    g.lineStyle(2, def.boss ? 0xb13e53 : 0x73eff7, 1).strokeRect(x + 1, y + 1, w - 2, 42);
    const icon = this.add.image(x + 24, y + 22, `${def.texture}_0`).setDepth(DEPTH.banner).setScrollFactor(0);
    if (def.tint !== undefined) icon.setTint(def.tint);
    const title = this.add
      .text(x + 46, y + 8, `${def.boss ? 'BOSS' : 'NEW ENEMY'}: ${def.name.toUpperCase()}`, {
        fontFamily: FONT,
        fontSize: '8px',
        color: def.boss ? '#ef7d57' : '#73eff7',
      })
      .setDepth(DEPTH.banner)
      .setScrollFactor(0);
    const tip = this.add
      .text(x + 46, y + 22, def.tip, { fontFamily: FONT, fontSize: '8px', color: '#f4f4f4', wordWrap: { width: w - 56 } })
      .setDepth(DEPTH.banner)
      .setLineSpacing(3)
      .setScrollFactor(0);
    this.callout = [g, icon, title, tip];
    // On big maps the main camera is zoomed out; keep the card at its normal size and off the minimap.
    for (const o of this.callout) this.pinToScreen(o as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject);
    this.tweens.add({
      targets: this.callout,
      alpha: 0,
      delay: 5000,
      duration: 500,
      onComplete: () => this.callout.forEach((o) => o.destroy()),
    });
  }

  /** The middle of what the player can see, for banners and messages. */
  private get viewCentre(): Point {
    const v = this.cameras.main.worldView;
    return { x: v.centerX || MAP_W / 2, y: v.centerY || MAP_H / 2 };
  }

  private banner(text: string, color: string): void {
    const c = this.viewCentre;
    banner(this, c.x, c.y, text, color);
  }

  /** Undo the camera's zoom on a screen-fixed object and hide it from the minimap. */
  private pinToScreen(o: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject): void {
    const cam = this.cameras.main;
    if (cam.zoom !== 1) {
      const z = 1 / cam.zoom;
      o.setScale(o.scaleX * z, o.scaleY * z);
      o.x = (o.x - MAP_W / 2) * z + MAP_W / 2;
      o.y = (o.y - MAP_H / 2) * z + MAP_H / 2;
    }
    for (const c of this.cameras.cameras) if (c !== cam) c.ignore(o);
  }

  // ----- Abilities -----

  /** Stealthy enemies are seen while a revealing tower is near. */
  private reveal(): void {
    const seers = this.towers.filter((t) => t.def.reveal && !t.broken);
    for (const e of this.enemies) {
      if (!e.canHide) continue;
      e.revealed = seers.some((t) => Math.hypot(e.pos.x - t.x, e.pos.y - t.y) <= t.def.reveal!);
    }
  }

  /** Towers with a slow aura chill every walker near them. */
  private towerAuras(): void {
    for (const t of this.towers) {
      const aura = t.def.slowAura;
      if (!aura || t.broken) continue;
      for (const e of this.enemies) {
        if (e.targetable && !e.flying && Math.hypot(e.pos.x - t.x, e.pos.y - t.y) <= aura.radius) e.slow(aura.factor, 0.2);
      }
    }
  }

  /** Enemies with a slow aura make towers near them reload slower. */
  private reloadRate(t: Tower): number {
    let rate = 1;
    for (const e of this.enemies) {
      const aura = e.def.slowAura;
      if (aura && e.targetable && Math.hypot(e.pos.x - t.x, e.pos.y - t.y) <= aura.radius) rate = Math.min(rate, aura.factor);
    }
    return rate;
  }

  private healers(dt: number): void {
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

  /** Triggered abilities: every few seconds, below some health, near a tower, or when hit. */
  private enemyAbilities(dt: number): void {
    for (const e of [...this.enemies]) {
      const abilities = e.def.abilities;
      if (!abilities || !e.targetable) {
        e.wasHit = false;
        continue;
      }
      abilities.forEach((a, i) => {
        const w = a.when;
        if (w.kind === 'every') {
          e.abilityTimers[i] -= dt;
          if (e.abilityTimers[i] <= 0) {
            e.abilityTimers[i] = w.seconds;
            this.act(e, a.action);
          }
        } else if (w.kind === 'below') {
          if (!e.abilityFired[i] && (e.hp / e.maxHp) * 100 < w.percent) {
            e.abilityFired[i] = true;
            this.act(e, a.action);
          }
        } else if (w.kind === 'near') {
          if (!e.abilityFired[i] && this.towers.some((t) => Math.hypot(t.x - e.pos.x, t.y - e.pos.y) <= w.radius)) {
            e.abilityFired[i] = true;
            this.act(e, a.action);
          }
        } else if (w.kind === 'hit' && e.wasHit && e.hitCooldown <= 0) {
          this.act(e, a.action);
        }
      });
      if (e.wasHit && e.hitCooldown <= 0 && abilities.some((a) => a.when.kind === 'hit')) e.hitCooldown = HIT_COOLDOWN;
      e.wasHit = false;
    }
  }

  /** Runs one enemy's abilities for a moment like appearing or being beaten. */
  private fireTriggers(e: Enemy, kind: 'spawn' | 'death'): void {
    for (const a of e.def.abilities ?? []) if (a.when.kind === kind) this.act(e, a.action);
  }

  private act(e: Enemy, action: EnemyAction): void {
    switch (action.type) {
      case 'spawn': {
        const def = this.content.enemies[action.enemy];
        if (!def || e.generation >= MAX_GENERATION) return;
        const kind = this.asWalker(def);
        const { route, progress, sameRoute } = this.childRoute(e, kind);
        for (let k = 0; k < action.count && this.enemies.length < MAX_ENEMIES; k++) {
          const child = new Enemy(this, kind, route, e.hpMultiplier, e.speedMultiplier, {
            // Children on the parent's own route spread out behind it; others start where it is.
            progress: sameRoute ? Math.max(0, progress - 6 - k * 8) : progress,
            generation: e.generation + 1,
            ground: this.groundAt,
          });
          this.addEnemy(child);
        }
        puff(this, e.pos.x, e.aimY, 0xa7f070);
        return;
      }
      case 'teleport':
        puff(this, e.pos.x, e.aimY);
        e.jump(action.distance);
        puff(this, e.pos.x, e.aimY);
        return;
      case 'speed':
        e.sprint(action.factor, action.duration);
        return;
      case 'explode':
        for (const t of this.towers) {
          if (Math.hypot(t.x - e.pos.x, t.y - e.pos.y) > action.radius) continue;
          this.damageTower(t, action.damage);
          if (action.stun > 0) t.stun(action.stun);
        }
        ring(this, e.pos.x, e.pos.y, action.radius, 0xef7d57);
        burst(this, e.pos.x, e.pos.y, 0xef7d57, 14, action.radius);
        return;
      case 'shield':
        e.addShield(action.amount * e.maxHp);
        ring(this, e.pos.x, e.aimY, 14, 0x41a6f6);
        return;
      case 'cloak':
        e.cloak(action.duration);
        return;
      case 'heal':
        e.heal(action.amount * e.maxHp);
        healSparkle(this, e.pos.x, e.aimY);
        return;
    }
  }

  /** Enemies that attack towers hit the nearest working one in range. */
  private enemyAttacks(dt: number): void {
    for (const e of this.enemies) {
      const atk = e.def.attack;
      if (!atk || !e.targetable) continue;
      e.attackTimer -= dt;
      if (e.attackTimer > 0) continue;
      let best: Tower | null = null;
      let bestD = atk.range;
      for (const t of this.towers) {
        const d = Math.hypot(t.x - e.pos.x, t.y - e.pos.y);
        if (!t.broken && d <= bestD) {
          best = t;
          bestD = d;
        }
      }
      if (!best) {
        e.attackTimer = 0.2;
        continue;
      }
      e.attackTimer = 1 / atk.rate;
      strike(this, { x: e.pos.x, y: e.aimY }, { x: best.x, y: best.y - 4 });
      this.damageTower(best, Math.round(atk.damage * Math.sqrt(e.hpMultiplier)));
    }
  }

  private damageTower(t: Tower, amount: number): void {
    if (amount <= 0) return;
    if (t.damage(amount)) {
      burst(this, t.x, t.y, 0x566c86, 14, 20);
      floatText(this, t.x, t.y - 16, 'BROKEN!', '#ef7d57');
    }
  }

  // ----- Traps -----

  private springTraps(): void {
    if (this.traps.length === 0) return;
    for (const trap of [...this.traps]) {
      for (const e of this.enemies) {
        if (!e.targetable || !e.walking || !trap.covers(e)) continue;
        const def = trap.def;
        if (def.kind === 'tar') e.slow(def.slow, 0.25);
        else if (def.kind === 'spikes' && !trap.hurt.has(e)) {
          trap.hurt.add(e);
          e.hit(def.damage);
          burst(this, e.pos.x, e.pos.y, 0xd0dae2, 4, 8);
          if (--trap.usesLeft <= 0) {
            floatText(this, trap.x, trap.y - 12, 'SPIKES BROKE', '#94b0c2');
            this.removeTrap(trap);
            break;
          }
        } else if (def.kind === 'bomb' && trap.armed) {
          trap.setArmed(false);
          for (const v of this.enemies) {
            if (v.targetable && v.walking && Math.hypot(v.pos.x - trap.x, v.pos.y - trap.y) <= def.radius) v.hit(def.damage);
          }
          meteorImpact(this, trap.x, trap.y, def.radius);
          break;
        }
      }
    }
  }

  private removeTrap(trap: Trap): void {
    this.trapAt.delete(this.cellKey(trap.col, trap.row));
    this.traps = this.traps.filter((t) => t !== trap);
    if (this.selectedTrap === trap) this.selectedTrap = null;
    trap.destroy();
  }

  private driftClouds(dt: number): void {
    const g = this.cloudGfx;
    g.clear();
    for (const c of this.clouds) {
      c.t -= dt;
      for (const e of this.enemies) {
        if (e.targetable && !e.flying && Math.hypot(e.pos.x - c.x, e.pos.y - c.y) <= c.radius) e.hurt(c.dps * dt);
      }
      g.fillStyle(0x38b764, Math.min(0.35, c.t)).fillCircle(c.x, c.y, c.radius);
      g.fillStyle(0xa7f070, Math.min(0.2, c.t)).fillCircle(c.x - c.radius * 0.3, c.y - c.radius * 0.2, c.radius * 0.5);
    }
    this.clouds = this.clouds.filter((c) => c.t > 0);
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

  // ----- Shooting -----

  private fire(tower: Tower, targets: Enemy[]): void {
    if (tower.def.instant) {
      for (const t of targets) this.zap(tower, t);
      return;
    }
    const m = tower.muzzle();
    for (const target of targets) {
      const crit = !!tower.def.crit && Math.random() < tower.def.crit.chance;
      const damage = Math.round(tower.stats.damage * (crit ? tower.def.crit!.mult : 1));
      this.projectiles.push(new Projectile(this, m.x, m.y, tower.def, tower.stats, target, damage, crit));
    }
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
        if (!e.seen || hit.includes(e) || (e.flying && !tower.def.hitsAir)) continue;
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
    const crit = !!tower.def.crit && Math.random() < tower.def.crit.chance;
    hit.forEach((e, i) => {
      const dmg = Math.max(1, Math.round(damage * Math.pow(0.85, i) * (crit ? tower.def.crit!.mult : 1)));
      e.hit(dmg, tower.def.pierce);
      this.onHitEffects(tower.def, tower.stats, e);
    });
    if (crit) floatText(this, first.pos.x, first.aimY - 14, 'CRIT!', '#ef7d57');
    lightningBolt(this, [{ x: tower.x, y: tower.y - 8 }, ...hit.map((e) => ({ x: e.pos.x, y: e.aimY }))]);
  }

  /** Slows, burns, stuns and knockback from one hit. */
  private onHitEffects(def: TowerDef, stats: TowerDef['levels'][number], e: Enemy): void {
    if (stats.slow) e.slow(stats.slow.factor, stats.slow.duration);
    if (def.burn) e.burn(def.burn.dps * (stats.damage / Math.max(1, def.levels[0].damage)), def.burn.duration);
    if (def.stun && Math.random() < def.stun.chance) e.freeze(def.stun.duration);
    if (def.knockback && e.walking) e.pushBack(def.knockback * (e.def.boss ? 0.5 : 1));
  }

  private impact(p: Projectile): void {
    const { stats } = p;
    const victims =
      stats.splash > 0
        ? this.enemies.filter(
            (e) => e.targetable && (!e.flying || e === p.target) && Math.hypot(e.pos.x - p.tx, e.pos.y - p.ty) <= stats.splash,
          )
        : p.target.targetable
          ? [p.target]
          : [];
    for (const e of victims) {
      e.hit(p.damage, p.pierce);
      this.onHitEffects(p.tower, stats, e);
    }
    if (p.crit) floatText(this, p.tx, p.ty - 14, 'CRIT!', '#ef7d57');
    const cloud = p.tower.cloud;
    if (cloud) this.clouds.push({ x: p.tx, y: p.ty, radius: cloud.radius, dps: cloud.dps, t: cloud.duration });
    switch (p.tower.shot) {
      case 'shell':
      case 'rock':
        ring(this, p.tx, p.ty, Math.max(stats.splash, 12), 0xef7d57);
        burst(this, p.tx, p.ty, 0x566c86, 6, 12);
        break;
      case 'frost':
        ring(this, p.tx, p.ty, Math.max(stats.splash, 12), 0x73eff7);
        break;
      case 'bolt':
        burst(this, p.tx, p.ty, 0xf4f4f4, 6, 10);
        break;
      case 'fire':
        burst(this, p.tx, p.ty, 0xef7d57, 8, 12);
        if (stats.splash > 0) ring(this, p.tx, p.ty, stats.splash, 0xffcd75);
        break;
      case 'poison':
        burst(this, p.tx, p.ty, 0xa7f070, 6, 10);
        break;
      case 'magic':
        ring(this, p.tx, p.ty, Math.max(stats.splash, 10), 0xc27bc2);
        break;
    }
  }

  private cleanupEnemies(): void {
    const castle = tileCenter(...this.level.path[this.level.path.length - 1]);
    const leaving = this.enemies.filter((e) => e.dead || e.escaped);
    if (leaving.length === 0) return;
    this.enemies = this.enemies.filter((e) => !e.dead && !e.escaped);
    for (const e of leaving) {
      if (e.dead) {
        const reward = killReward(this.difficulty, e.def.reward);
        this.economy.earn(reward);
        burst(this, e.pos.x, e.aimY, e.def.color, e.def.boss ? 30 : 10, e.def.boss ? 36 : 18);
        floatText(this, e.pos.x, e.aimY - 10, `+${reward}`);
        if (e.def.boss) this.banner(`${e.def.name.toUpperCase()}\nDEFEATED!`, '#ffcd75');
        this.fireTriggers(e, 'death');
      } else {
        this.economy.loseLives(e.def.livesCost);
        this.leaks[e.def.key] = (this.leaks[e.def.key] ?? 0) + e.def.livesCost;
        if (fx.enabled) this.cameras.main.shake(e.def.boss ? 400 : 120, e.def.boss ? 0.012 : 0.004);
        floatText(this, castle.x - 8, castle.y - 18, `-${e.def.livesCost}`, '#b13e53');
      }
      e.destroy();
    }
  }

  private waveCleared(): void {
    const n = this.waves.current;
    const bonus = waveClearBonus(n);
    this.economy.earn(bonus);
    // Damaged towers mend between waves; broken ones still need repairing.
    for (const t of this.towers) if (!t.broken) t.repair();
    if (!this.waves.hasNext) {
      this.endGame(true);
      return;
    }
    this.phase = 'build';
    this.countdown = BETWEEN_WAVES;
    this.banner(`WAVE ${n} CLEAR\n+${bonus} GOLD`, '#a7f070');
  }

  private endGame(won: boolean): void {
    this.phase = won ? 'won' : 'lost';
    this.placement.cancel();
    this.selected = null;
    this.selectedTrap = null;
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
        version: this.custom ? undefined : this.content.version?.name,
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
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows ? { col, row } : null;
  }

  isBuildable(col: number, row: number): boolean {
    return this.grid[row]?.[col] === 'grass' && !this.towerAt.has(this.cellKey(col, row));
  }

  /** Road squares (not bridges, portals or the castle) without a trap already. */
  canTrap(col: number, row: number): boolean {
    const key = this.cellKey(col, row);
    return isTrapTile(this.grid[row]?.[col]) && !this.trapAt.has(key) && !this.ends.has(key);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    // A finger drags the map around (and pinching zooms); so does a held mouse button on big maps.
    if (this.mapCam.move(p)) return;
    // A finger only moves the preview while it is dragging on the map; it never leaves it on the HUD.
    if (p.wasTouch && (!p.isDown || !this.cellAt(p))) return;
    this.placement.setHover(this.cellAt(p));
    this.aimPos = this.toWorld(p);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    this.touchMode = p.wasTouch;
    if (p.x >= MAP_W) return; // the HUD is handled by the UI scene
    if (this.mapCam.onMinimap(p.x, p.y)) {
      this.mapCam.jumpFromMinimap(p.x, p.y);
      return;
    }
    // Fingers act when lifted, so a drag or pinch never builds by accident. The mouse acts at once,
    // unless the map can be dragged around; then it waits too, to tell a click from a drag.
    this.mapCam.down(p);
    this.mouseActed = !p.wasTouch && (p.rightButtonDown() || !this.mapCam.pannable);
    if (this.mouseActed) this.handleTap(p);
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    const tap = this.mapCam.up(p);
    if (!p.wasTouch && this.mouseActed) return;
    if (tap && p.x < MAP_W && !this.mapCam.onMinimap(p.x, p.y)) this.handleTap(p);
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
      const placed = this.placement.isTrap
        ? this.tryTrap(this.placement.type, cell.col, cell.row)
        : this.tryPlace(this.placement.type, cell.col, cell.row);
      const keepPlacing = !p.wasTouch && (p.event as MouseEvent).shiftKey;
      if (placed && !keepPlacing) this.placement.cancel();
      return;
    }
    const key = this.cellKey(cell.col, cell.row);
    this.selected = this.towerAt.get(key) ?? null;
    this.selectedTrap = this.selected ? null : (this.trapAt.get(key) ?? null);
  }

  private isNearAim(x: number, y: number): boolean {
    return this.aimPos !== null && Math.hypot(x - this.aimPos.x, y - this.aimPos.y) <= METEOR.radius;
  }

  /** Builds a tower if the tile is free and the player can pay. */
  tryPlace(type: string, col: number, row: number): boolean {
    const def = this.towerDefs[type];
    const { x, y } = tileCenter(col, row);
    if (!def || !this.isUnlocked(type)) return false;
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

  /** Lays a trap on a road square if there is room, gold, and fewer than its limit. */
  tryTrap(type: string, col: number, row: number): boolean {
    const def: TrapDef | undefined = this.content.traps[type];
    const { x, y } = tileCenter(col, row);
    if (!def) return false;
    if (!this.canTrap(col, row)) {
      floatText(this, x, y - 12, 'ROAD ONLY', '#b13e53');
      return false;
    }
    if (this.trapCount(type) >= def.max) {
      floatText(this, x, y - 12, `ONLY ${def.max}`, '#b13e53');
      return false;
    }
    if (!this.economy.spend(def.cost)) {
      floatText(this, x, y - 12, 'NEED GOLD', '#b13e53');
      return false;
    }
    const trap = new Trap(this, def, col, row);
    this.traps.push(trap);
    this.trapAt.set(this.cellKey(col, row), trap);
    return true;
  }

  private drawRanges(): void {
    const g = this.rangeGfx;
    g.clear();
    const { type, hover } = this.placement;
    if (this.aimingMeteor && this.aimPos) {
      g.fillStyle(0xef7d57, 0.15).fillCircle(this.aimPos.x, this.aimPos.y, METEOR.radius);
      g.lineStyle(2, 0xef7d57, 0.9).strokeCircle(this.aimPos.x, this.aimPos.y, METEOR.radius);
    } else if (type && hover && this.placement.isTrap) {
      const def = this.content.traps[type];
      const ok = this.canTrap(hover.col, hover.row) && this.economy.canAfford(def.cost) && this.trapCount(type) < def.max;
      this.placement.setValid(ok);
      const color = ok ? 0xa7f070 : 0xb13e53;
      const { x, y } = tileCenter(hover.col, hover.row);
      if (def.kind === 'bomb') g.lineStyle(2, color, 0.7).strokeCircle(x, y, def.radius);
      g.lineStyle(2, color, 0.9).strokeRect(hover.col * TILE + 1, hover.row * TILE + 1, TILE - 2, TILE - 2);
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
      if (t.def.reveal) g.lineStyle(1, 0xffcd75, 0.6).strokeCircle(t.x, t.y, t.def.reveal);
      g.lineStyle(2, 0xffcd75, 1).strokeRect(t.col * TILE + 1, t.row * TILE + 1, TILE - 2, TILE - 2);
    } else if (this.selectedTrap) {
      const t = this.selectedTrap;
      if (t.def.kind === 'bomb') g.lineStyle(2, 0xf4f4f4, 0.5).strokeCircle(t.x, t.y, t.def.radius);
      g.lineStyle(2, 0xffcd75, 1).strokeRect(t.col * TILE + 1, t.row * TILE + 1, TILE - 2, TILE - 2);
    }
  }

  private drawBars(): void {
    const g = this.bars;
    g.clear();
    for (const e of this.enemies) {
      if ((e.hp >= e.maxHp && e.shield <= 0) || e.hidden) continue;
      const scale = e.def.scale ?? 1;
      const w = Math.round(20 * scale);
      const x = Math.round(e.pos.x - w / 2);
      const y = Math.round(e.aimY - 18 * scale);
      const frac = e.hp / e.maxHp;
      g.fillStyle(0x1a1c2c, 1).fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(0xb13e53, 1).fillRect(x, y, w, 3);
      g.fillStyle(frac > 0.5 ? 0xa7f070 : frac > 0.25 ? 0xffcd75 : 0xef7d57, 1).fillRect(x, y, Math.ceil(w * frac), 3);
      if (e.shield > 0) g.fillStyle(0x41a6f6, 1).fillRect(x, y - 2, Math.ceil(w * Math.min(1, e.shield / e.maxHp)), 2);
      if (e.def.armor) g.fillStyle(0x94b0c2, 1).fillRect(x - 1, y + 4, w + 2, 1);
    }
    for (const t of this.towers) {
      if (t.hp >= t.maxHp && !t.broken) continue;
      const x = t.x - 12;
      const y = t.y + 12;
      g.fillStyle(0x1a1c2c, 1).fillRect(x - 1, y - 1, 26, 5);
      g.fillStyle(t.broken ? 0x566c86 : 0xef7d57, 1).fillRect(x, y, Math.ceil((24 * t.hp) / t.maxHp), 3);
    }
  }
}

/** The point of a route nearest to a position: how far along the route it is, and how far away. */
function nearestOnRoute(route: Point[], at: Point): { progress: number; d: number } {
  let best = { progress: 0, d: Infinity };
  let walked = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = len ? Math.max(0, Math.min(1, ((at.x - a.x) * (b.x - a.x) + (at.y - a.y) * (b.y - a.y)) / (len * len))) : 0;
    const d = Math.hypot(a.x + (b.x - a.x) * t - at.x, a.y + (b.y - a.y) * t - at.y);
    if (d < best.d) best = { progress: walked + len * t, d };
    walked += len;
  }
  return best;
}
