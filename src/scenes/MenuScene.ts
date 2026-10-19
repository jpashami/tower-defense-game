import Phaser from 'phaser';
import { DEPTH, FONT, GAME_H, GAME_W, MAP_H, MAP_W } from '../config/constants';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  loadDifficulty,
  saveDifficulty,
  type DifficultyKey,
} from '../config/difficulty';
import { ENEMIES, type EnemyKey } from '../config/enemies';
import { BUILTIN_LEVEL, randomLevel, type LevelDef } from '../config/level';
import { buildGrid, pathPoints, tileCenter } from '../config/map';
import { loadMapMode, loadShortcutEnabled, saveMapMode, saveShortcutEnabled, type MapMode } from '../config/settings';
import { SHORTCUT } from '../config/shortcut';
import { WAVES } from '../config/waves';
import { Enemy } from '../entities/Enemy';
import { randomSeed } from '../systems/MapGenerator';
import { renderMap } from '../systems/MapRenderer';
import { Button } from '../ui/Button';
import { isTouchDevice } from '../ui/touch';

/** Title screen: a preview of the next map with enemies wandering behind the menu. */
export class MenuScene extends Phaser.Scene {
  private walkers: Enemy[] = [];
  private spawnTimer = 0;
  private spawnCount = 0;
  private difficulty: DifficultyKey = 'normal';
  private mapMode: MapMode = 'random';
  private shortcutOn = true;
  private seed = 1;
  private level!: LevelDef;
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private diffButtons: Button[] = [];
  private diffText!: Phaser.GameObjects.Text;
  private mapBtn!: Button;
  private newMapBtn!: Button;
  private shortcutBtn!: Button;
  private mapText!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.walkers = [];
    this.mapObjects = [];
    this.spawnTimer = 0;
    this.spawnCount = 0;
    this.difficulty = loadDifficulty();
    this.mapMode = loadMapMode();
    this.shortcutOn = loadShortcutEnabled();
    this.seed = randomSeed();

    this.add.rectangle(MAP_W, 0, GAME_W - MAP_W, MAP_H, 0x1a1c2c).setOrigin(0).setDepth(19);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1a1c2c, 0.55).setOrigin(0).setDepth(20);

    const cx = GAME_W / 2;
    const title = (y: number, text: string, size: number, color: string) =>
      this.add
        .text(cx, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1a1c2c', strokeThickness: size / 2, align: 'center' })
        .setOrigin(0.5)
        .setDepth(21);

    const t = title(78, 'PIXEL TOWER\nDEFENCE', 32, '#ffcd75');
    t.setLineSpacing(12);
    this.tweens.add({ targets: t, y: 84, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    title(150, `Hold the castle for ${WAVES.length} waves`, 8, '#94b0c2');

    // Difficulty picker.
    const bw = 96;
    const left = cx - (bw * 3 + 16) / 2;
    this.diffButtons = DIFFICULTY_ORDER.map(
      (key, i) =>
        new Button(this, {
          x: left + i * (bw + 8),
          y: 164,
          w: bw,
          h: 28,
          label: DIFFICULTIES[key].name.toUpperCase(),
          depth: 21,
          onClick: () => this.setDifficulty(key),
        }),
    );
    this.diffText = title(202, '', 8, '#f4f4f4');

    // Map choices.
    const mx = cx - 184;
    this.mapBtn = new Button(this, { x: mx, y: 216, w: 128, h: 28, label: '', depth: 21, onClick: () => this.toggleMapMode() });
    this.newMapBtn = new Button(this, { x: mx + 136, y: 216, w: 96, h: 28, label: 'NEW MAP', depth: 21, onClick: () => this.reroll() });
    this.shortcutBtn = new Button(this, { x: mx + 240, y: 216, w: 128, h: 28, label: '', depth: 21, onClick: () => this.toggleShortcut() });
    this.mapText = title(254, '', 8, '#94b0c2');

    const play = new Button(this, {
      x: cx - 168,
      y: 272,
      w: 160,
      h: 36,
      label: 'PLAY',
      variant: 'primary',
      depth: 21,
      onClick: () => this.startGame(),
    });
    play.label?.setFontSize(16);
    const create = new Button(this, {
      x: cx + 8,
      y: 272,
      w: 160,
      h: 36,
      label: 'CREATE',
      variant: 'accent',
      depth: 21,
      onClick: () => this.scene.start('Editor'),
    });
    create.label?.setFontSize(16);

    title(
      340,
      'Build towers beside the path. New enemies need new tactics:\narmour, flyers, healers and bosses. Watch for the shortcut!',
      8,
      '#f4f4f4',
    ).setLineSpacing(8);
    title(
      392,
      isTouchDevice()
        ? 'Tap a tower in the shop, tap a grass square to see it,\nthen tap the same square again to build it.'
        : 'KEYS  1-5 build   U upgrade   S sell   T target\nQ meteor   W freeze   SPACE wave   F speed   P pause',
      8,
      '#566c86',
    ).setLineSpacing(8);

    const kb = this.input.keyboard;
    kb?.once('keydown-ENTER', () => this.startGame());
    kb?.once('keydown-SPACE', () => this.startGame());
    kb?.on('keydown-LEFT', () => this.stepDifficulty(-1));
    kb?.on('keydown-RIGHT', () => this.stepDifficulty(1));
    kb?.on('keydown-N', () => this.reroll());

    this.setDifficulty(this.difficulty);
    this.refreshMap();
  }

  private setDifficulty(key: DifficultyKey): void {
    this.difficulty = key;
    saveDifficulty(key);
    const d = DIFFICULTIES[key];
    DIFFICULTY_ORDER.forEach((k, i) => this.diffButtons[i].setActive(k === key));
    this.diffText.setText(`${d.description}  ${d.startLives} lives, ${d.startMoney} gold`).setColor(d.color);
  }

  private stepDifficulty(dir: number): void {
    const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
    const next = Phaser.Math.Clamp(i + dir, 0, DIFFICULTY_ORDER.length - 1);
    this.setDifficulty(DIFFICULTY_ORDER[next]);
  }

  private toggleMapMode(): void {
    this.mapMode = this.mapMode === 'random' ? 'classic' : 'random';
    saveMapMode(this.mapMode);
    this.refreshMap();
  }

  private toggleShortcut(): void {
    this.shortcutOn = !this.shortcutOn;
    saveShortcutEnabled(this.shortcutOn);
    this.refreshMap();
  }

  private reroll(): void {
    if (this.mapMode !== 'random') return;
    this.seed = randomSeed();
    this.refreshMap();
  }

  /** Redraws the background map to show what PLAY will start. */
  private refreshMap(): void {
    const random = this.mapMode === 'random';
    this.level = random ? randomLevel(this.seed) : BUILTIN_LEVEL;
    this.mapBtn.setLabel(random ? 'RANDOM MAP' : 'CLASSIC MAP').setActive(random);
    this.newMapBtn.setEnabled(random);
    this.shortcutBtn.setLabel(`SHORTCUT ${this.shortcutOn ? 'ON' : 'OFF'}`).setActive(this.shortcutOn).setEnabled(random);
    this.mapText.setText(
      random
        ? `Map #${this.seed}${this.shortcutOn ? `  -  shortcut opens on wave ${SHORTCUT.opensOnWave}` : ''}`
        : 'The original hand-made map (no shortcut)',
    );

    for (const o of this.mapObjects) o.destroy();
    for (const w of this.walkers) w.destroy();
    this.walkers = [];
    const grid = buildGrid(this.level.path, this.level.decorations);
    const sc = random && this.shortcutOn ? this.level.shortcut : undefined;
    if (sc) for (const [c, r] of sc.tiles) grid[r][c] = 'shortcut';
    this.mapObjects = renderMap(this, grid, this.level.path, this.level.decorations);
    if (sc) {
      for (const [c, r] of [sc.tiles[0], sc.tiles[sc.tiles.length - 1]]) {
        const { x, y } = tileCenter(c, r);
        this.mapObjects.push(this.add.image(x, y, 'gate').setDepth(DEPTH.towerBase));
      }
    }
  }

  private startGame(): void {
    this.scene.start('Game', { difficulty: this.difficulty, seed: this.seed, map: this.mapMode });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const order: EnemyKey[] = ['grunt', 'runner', 'knight', 'grunt', 'wolf', 'shaman', 'brute', 'runner'];
      const key = order[this.spawnCount++ % order.length];
      this.walkers.push(new Enemy(this, ENEMIES[key], pathPoints(this.level.path), 1));
      this.spawnTimer = 1.3;
    }
    for (const w of this.walkers) w.step(dt);
    this.walkers = this.walkers.filter((w) => {
      if (w.escaped) w.destroy();
      return !w.escaped;
    });
  }
}
