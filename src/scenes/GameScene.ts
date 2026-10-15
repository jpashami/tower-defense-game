import Phaser from 'phaser';
import { BETWEEN_WAVES, COLS, DEPTH, MAP_H, MAP_W, ROWS, START_LIVES, START_MONEY, TILE } from '../config/constants';
import { ENEMIES, type EnemyKey } from '../config/enemies';
import { buildGrid, pathPoints, PATH_TILES, tileCenter, type Point, type TileType } from '../config/map';
import { TOWERS, TOWER_ORDER, type TowerKey } from '../config/towers';
import { WAVES, waveClearBonus, waveHpMultiplier } from '../config/waves';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Tower } from '../entities/Tower';
import { Economy } from '../systems/Economy';
import { banner, burst, floatText, ring } from '../systems/Effects';
import { renderMap } from '../systems/MapRenderer';
import { PlacementController } from '../systems/PlacementController';
import { WaveManager } from '../systems/WaveManager';

export type Phase = 'build' | 'wave' | 'won' | 'lost';

/**
 * The battlefield. Owns all game state; the UI scene reads it every frame
 * and calls the public methods below in response to button presses.
 */
export class GameScene extends Phaser.Scene {
  economy!: Economy;
  waves!: WaveManager;
  phase: Phase = 'build';
  /** Seconds until the next wave starts on its own; 0 means waiting for the player. */
  countdown = 0;
  speed = 1;
  paused = false;
  selected: Tower | null = null;
  placement!: PlacementController;

  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];
  private towerAt = new Map<string, Tower>();
  private grid!: TileType[][];
  private path!: Point[];
  private bars!: Phaser.GameObjects.Graphics;
  private rangeGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Game');
  }

  create(): void {
    // The scene object is reused on restart, so reset everything here.
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.towerAt = new Map();
    this.selected = null;
    this.phase = 'build';
    this.countdown = 0;
    this.speed = 1;
    this.paused = false;

    this.grid = buildGrid();
    this.path = pathPoints();
    renderMap(this, this.grid);
    this.economy = new Economy(START_MONEY, START_LIVES);
    this.waves = new WaveManager(WAVES);
    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.rangeGfx = this.add.graphics().setDepth(DEPTH.range);
    this.placement = new PlacementController(this);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    const kb = this.input.keyboard;
    if (kb) {
      ['ONE', 'TWO', 'THREE'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.beginPlacement(TOWER_ORDER[i])));
      kb.on('keydown-ESC', () => this.cancelAll());
      kb.on('keydown-SPACE', () => this.startNextWave());
      kb.on('keydown-U', () => this.upgradeSelected());
      kb.on('keydown-S', () => this.sellSelected());
      kb.on('keydown-F', () => this.toggleSpeed());
      kb.on('keydown-P', () => this.togglePause());
    }

    this.scene.launch('UI');
    banner(this, MAP_W / 2, MAP_H / 2, 'BUILD YOUR\nDEFENCES', '#ffcd75');

    if (import.meta.env.DEV) (window as unknown as { gameScene: GameScene }).gameScene = this;
  }

  // ---------- Public actions (UI buttons and hotkeys) ----------

  beginPlacement(type: TowerKey): void {
    if (this.isOver) return;
    if (this.placement.type === type) {
      this.placement.cancel();
      return;
    }
    this.selected = null;
    this.placement.begin(type);
  }

  cancelAll(): void {
    this.placement.cancel();
    this.selected = null;
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
    banner(this, MAP_W / 2, MAP_H / 2, `WAVE ${this.waves.current}`);
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

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
  }

  togglePause(): void {
    if (!this.isOver) this.paused = !this.paused;
  }

  get isOver(): boolean {
    return this.phase === 'won' || this.phase === 'lost';
  }

  get enemiesAlive(): number {
    return this.enemies.length;
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

    this.waves.update(dt, (key) => this.spawnEnemy(key));
    for (const e of this.enemies) e.step(dt);

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

  private spawnEnemy(key: EnemyKey): void {
    this.enemies.push(new Enemy(this, ENEMIES[key], this.path, waveHpMultiplier(this.waves.current)));
  }

  private fire(tower: Tower, target: Enemy): void {
    const m = tower.muzzle();
    this.projectiles.push(
      new Projectile(this, m.x, m.y, tower.def.projectileTexture, tower.def.key, tower.stats, target),
    );
  }

  private impact(p: Projectile): void {
    const { stats } = p;
    const victims =
      stats.splash > 0
        ? this.enemies.filter((e) => e.targetable && Math.hypot(e.pos.x - p.tx, e.pos.y - p.ty) <= stats.splash)
        : p.target.targetable
          ? [p.target]
          : [];
    for (const e of victims) {
      e.hit(stats.damage);
      if (stats.slow) e.slow(stats.slow.factor, stats.slow.duration);
    }
    if (p.kind === 'cannon') {
      ring(this, p.tx, p.ty, stats.splash, 0xef7d57);
      burst(this, p.tx, p.ty, 0x566c86, 6, 12);
    } else if (p.kind === 'frost') {
      ring(this, p.tx, p.ty, Math.max(stats.splash, 12), 0x73eff7);
    }
  }

  private cleanupEnemies(): void {
    const castle = tileCenter(...PATH_TILES[PATH_TILES.length - 1]);
    this.enemies = this.enemies.filter((e) => {
      if (e.dead) {
        this.economy.earn(e.def.reward);
        burst(this, e.pos.x, e.pos.y, e.def.color, 10, 18);
        floatText(this, e.pos.x, e.pos.y - 10, `+${e.def.reward}`);
        e.destroy();
        return false;
      }
      if (e.escaped) {
        this.economy.loseLives(e.def.livesCost);
        this.cameras.main.shake(120, 0.004);
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
    this.time.delayedCall(won ? 1200 : 600, () => {
      this.scene.pause('UI');
      this.scene.launch('GameOver', { won, wave: this.waves.current, lives: this.economy.lives });
      this.scene.pause();
    });
  }

  private cellKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  private cellAt(p: Phaser.Input.Pointer): { col: number; row: number } | null {
    if (p.x < 0 || p.x >= MAP_W || p.y < 0 || p.y >= MAP_H) return null;
    return { col: Math.floor(p.x / TILE), row: Math.floor(p.y / TILE) };
  }

  isBuildable(col: number, row: number): boolean {
    return (
      col >= 0 && col < COLS && row >= 0 && row < ROWS &&
      this.grid[row][col] === 'grass' &&
      !this.towerAt.has(this.cellKey(col, row))
    );
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    this.placement.setHover(this.cellAt(p));
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.isOver) return;
    const cell = this.cellAt(p);
    if (!cell) return; // clicks on the HUD panel are handled by the UI scene
    if (p.rightButtonDown()) {
      this.cancelAll();
      return;
    }
    if (this.placement.type) {
      const placed = this.tryPlace(this.placement.type, cell.col, cell.row);
      const keepPlacing = (p.event as MouseEvent).shiftKey;
      if (placed && !keepPlacing) this.placement.cancel();
      return;
    }
    this.selected = this.towerAt.get(this.cellKey(cell.col, cell.row)) ?? null;
  }

  private tryPlace(type: TowerKey, col: number, row: number): boolean {
    const def = TOWERS[type];
    const { x, y } = tileCenter(col, row);
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
    if (type && hover) {
      const def = TOWERS[type];
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
      const w = 20;
      const x = Math.round(e.pos.x - w / 2);
      const y = Math.round(e.pos.y - 20);
      const frac = e.hp / e.maxHp;
      g.fillStyle(0x1a1c2c, 1).fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(0xb13e53, 1).fillRect(x, y, w, 3);
      g.fillStyle(frac > 0.5 ? 0xa7f070 : frac > 0.25 ? 0xffcd75 : 0xef7d57, 1).fillRect(x, y, Math.ceil(w * frac), 3);
    }
  }
}
