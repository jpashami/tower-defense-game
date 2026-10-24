import Phaser from 'phaser';
import { DEPTH, FONT, GAME_W, MAP_H, MAP_W } from '../config/constants';
import { DIFFICULTY_ORDER, loadDifficulty, saveDifficulty, type DifficultyKey } from '../config/difficulty';
import type { LevelDef } from '../config/level';
import { buildGrid, pathPoints, tileCenter } from '../config/map';
import { loadMapMode, loadShortcutEnabled, saveMapMode, saveShortcutEnabled, type MapMode } from '../config/settings';
import { SHORTCUT } from '../config/shortcut';
import { Enemy } from '../entities/Enemy';
import { currentPlayer } from '../profile/players';
import { randomSeed } from '../systems/MapGenerator';
import { renderMap } from '../systems/MapRenderer';
import { Button } from '../ui/Button';
import { centreScene, fullScreenRect } from '../ui/layout';
import { isTouchDevice } from '../ui/touch';
import { difficultyFor, type GameContent } from '../version/compile';
import { onIncoming, takeIncoming } from '../version/incoming';
import { isRandomPlan, levelForContent } from '../version/levels';
import { activeContent } from '../version/registry';
import { ensureVersionTextures } from '../version/textures';

/** Title screen: a preview of the next map with enemies wandering behind the menu. */
export class MenuScene extends Phaser.Scene {
  private walkers: Enemy[] = [];
  private spawnTimer = 0;
  private spawnCount = 0;
  private difficulty: DifficultyKey = 'normal';
  private mapMode: MapMode = 'random';
  private shortcutOn = true;
  private seed = 1;
  private content!: GameContent;
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
    centreScene(this);
    this.walkers = [];
    this.mapObjects = [];
    this.spawnTimer = 0;
    this.spawnCount = 0;
    this.content = activeContent();
    ensureVersionTextures(this, this.content);
    this.difficulty = loadDifficulty();
    this.mapMode = loadMapMode();
    this.shortcutOn = loadShortcutEnabled();
    this.seed = randomSeed();

    this.add.rectangle(MAP_W, 0, GAME_W - MAP_W, MAP_H, 0x1a1c2c).setOrigin(0).setDepth(19);
    fullScreenRect(this, 0x1a1c2c, 0.55).setDepth(20);

    const cx = GAME_W / 2;
    const title = (y: number, text: string, size: number, color: string) =>
      this.add
        .text(cx, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1a1c2c', strokeThickness: size / 2, align: 'center' })
        .setOrigin(0.5)
        .setDepth(21);

    // Who's playing, and which version: tap either to change it.
    const player = currentPlayer();
    const playerBtn = new Button(this, { x: 8, y: 8, w: 156, h: 26, label: player.name, depth: 21, onClick: () => this.scene.start('Players') });
    const swatch = this.add.rectangle(20, 21, 10, 10, Phaser.Display.Color.HexStringToColor(player.color).color).setDepth(22);
    playerBtn.label?.setX(playerBtn.label.x + 8);
    void swatch;
    const v = this.content.version;
    new Button(this, {
      x: GAME_W - 8 - 220,
      y: 8,
      w: 220,
      h: 26,
      label: v ? `VERSION: ${v.name}`.slice(0, 26) : 'VERSION: CLASSIC',
      variant: v ? 'accent' : 'default',
      depth: 21,
      onClick: () => this.scene.start('Versions'),
    });

    const t = title(70, 'PIXEL TOWER\nDEFENCE', 32, '#ffcd75');
    t.setLineSpacing(12);
    this.tweens.add({ targets: t, y: 76, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const accent = `#${this.content.theme.accent.toString(16).padStart(6, '0')}`;
    title(140, v ? `${v.name}${v.author ? ` by ${v.author}` : ''}` : `Hold the castle for ${this.content.waves.length} waves`, 8, v ? accent : '#94b0c2');

    // Difficulty picker.
    const bw = 96;
    const left = cx - (bw * 3 + 16) / 2;
    this.diffButtons = DIFFICULTY_ORDER.map(
      (key, i) =>
        new Button(this, {
          x: left + i * (bw + 8),
          y: 158,
          w: bw,
          h: 28,
          label: difficultyFor(key, null).name.toUpperCase(),
          depth: 21,
          onClick: () => this.setDifficulty(key),
        }),
    );
    this.diffText = title(196, '', 8, '#f4f4f4');

    // Map choices (versions with their own map only offer a new roll of it).
    const mx = cx - 184;
    this.mapBtn = new Button(this, { x: mx, y: 210, w: 128, h: 28, label: '', depth: 21, onClick: () => this.toggleMapMode() });
    this.newMapBtn = new Button(this, { x: mx + 136, y: 210, w: 96, h: 28, label: 'NEW MAP', depth: 21, onClick: () => this.reroll() });
    this.shortcutBtn = new Button(this, { x: mx + 240, y: 210, w: 128, h: 28, label: '', depth: 21, onClick: () => this.toggleShortcut() });
    this.mapText = title(248, '', 8, '#94b0c2');

    const big = (x: number, label: string, variant: 'primary' | 'accent', onClick: () => void) => {
      const b = new Button(this, { x, y: 266, w: 150, h: 36, label, variant, depth: 21, onClick });
      b.label?.setFontSize(label.length > 6 ? 12 : 16);
      return b;
    };
    big(cx - 233, 'PLAY', 'primary', () => this.startGame());
    big(cx - 75, 'CREATE', 'accent', () => this.scene.start('Editor'));
    big(cx + 83, 'MY VERSION', 'accent', () => this.scene.start('Versions'));

    title(
      336,
      'Build towers beside the path. New enemies need new tactics:\narmour, flyers, healers and bosses. Make your own version with Claude!',
      8,
      '#f4f4f4',
    ).setLineSpacing(8);
    title(
      388,
      isTouchDevice()
        ? 'Tap a tower in the shop, tap a grass square to see it,\nthen tap it again to build. Pinch the map to zoom in.'
        : 'KEYS  1-8 build   U upgrade   S sell   T target   R repair\nQ meteor   W freeze   SPACE wave   F speed   P pause   WHEEL zoom',
      8,
      '#566c86',
    ).setLineSpacing(8);

    new Button(this, { x: cx - 100, y: 438, w: 200, h: 26, label: 'SUGGEST A FEATURE', depth: 21, onClick: () => this.scene.start('Suggest') });

    const kb = this.input.keyboard;
    kb?.once('keydown-ENTER', () => this.startGame());
    kb?.once('keydown-SPACE', () => this.startGame());
    kb?.on('keydown-LEFT', () => this.stepDifficulty(-1));
    kb?.on('keydown-RIGHT', () => this.stepDifficulty(1));
    kb?.on('keydown-N', () => this.reroll());

    this.setDifficulty(this.difficulty);
    this.refreshMap();

    // A version that came in a link: offer it now, or as soon as it has been read.
    const incoming = takeIncoming();
    if (incoming) this.time.delayedCall(10, () => this.scene.start('Versions', { incoming }));
    onIncoming((r) => this.scene.isActive() && this.scene.start('Versions', { incoming: r }));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => onIncoming(null));
  }

  private setDifficulty(key: DifficultyKey): void {
    this.difficulty = key;
    saveDifficulty(key);
    const d = difficultyFor(key, this.content.rules);
    DIFFICULTY_ORDER.forEach((k, i) => this.diffButtons[i].setActive(k === key));
    this.diffText.setText(`${d.description}  ${d.startLives} lives, ${d.startMoney} gold`).setColor(d.color);
  }

  private stepDifficulty(dir: number): void {
    const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
    const next = Phaser.Math.Clamp(i + dir, 0, DIFFICULTY_ORDER.length - 1);
    this.setDifficulty(DIFFICULTY_ORDER[next]);
  }

  /** The default game lets players pick random or classic maps and the shortcut; versions bring their own map. */
  private get ownsMap(): boolean {
    return this.content.map.kind !== 'menu';
  }

  private toggleMapMode(): void {
    if (this.ownsMap) return;
    this.mapMode = this.mapMode === 'random' ? 'classic' : 'random';
    saveMapMode(this.mapMode);
    this.refreshMap();
  }

  private toggleShortcut(): void {
    if (this.ownsMap) return;
    this.shortcutOn = !this.shortcutOn;
    saveShortcutEnabled(this.shortcutOn);
    this.refreshMap();
  }

  private reroll(): void {
    if (!isRandomPlan(this.content, this.mapMode)) return;
    this.seed = randomSeed();
    this.refreshMap();
  }

  /** Redraws the background map to show what PLAY will start. */
  private refreshMap(): void {
    const plan = this.content.map;
    const random = isRandomPlan(this.content, this.mapMode);
    this.level = levelForContent(this.content, this.seed, this.mapMode, this.shortcutOn);
    if (this.ownsMap) {
      this.mapBtn.setLabel(plan.kind === 'drawn' ? 'DRAWN MAP' : 'RANDOM MAP').setActive(true).setEnabled(false);
      this.shortcutBtn.setLabel(`SHORTCUT ${this.level.shortcut ? 'ON' : 'OFF'}`).setEnabled(false);
    } else {
      this.mapBtn.setLabel(random ? 'RANDOM MAP' : 'CLASSIC MAP').setActive(random).setEnabled(true);
      this.shortcutBtn.setLabel(`SHORTCUT ${this.shortcutOn ? 'ON' : 'OFF'}`).setActive(this.shortcutOn).setEnabled(random);
    }
    this.newMapBtn.setEnabled(random);
    const size = `${this.level.cols ?? 20}x${this.level.rows ?? 15}`;
    this.mapText.setText(
      plan.kind === 'drawn'
        ? `This version's own hand-drawn map (${size})`
        : random
          ? `Map #${this.seed} (${size})${this.level.shortcut ? `  -  shortcut opens on wave ${SHORTCUT.opensOnWave}` : ''}${this.level.boatRoute ? '  -  with a river' : ''}`
          : 'The original hand-made map (no shortcut)',
    );

    for (const o of this.mapObjects) o.destroy();
    for (const w of this.walkers) w.destroy();
    this.walkers = [];
    const level = this.level;
    const grid = buildGrid(level.path, level.decorations, { cols: level.cols, rows: level.rows, extraPaths: level.extraPaths, terrain: level.terrain });
    const sc = level.shortcut;
    if (sc) for (const [c, r] of sc.tiles) grid[r][c] = 'shortcut';
    this.mapObjects = renderMap(this, grid, level.path, level.decorations, { extraPaths: level.extraPaths, boatRoute: level.boatRoute });
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
      this.spawnWalker();
      this.spawnTimer = 1.3;
    }
    for (const w of this.walkers) w.step(dt);
    this.walkers = this.walkers.filter((w) => {
      if (w.escaped) w.destroy();
      return !w.escaped;
    });
  }

  /** The default game parades its classic enemies; a version shows off its own. */
  private spawnWalker(): void {
    const own = (this.content.version?.enemies ?? []).map((e) => e.id);
    const order = own.length ? own : ['grunt', 'runner', 'knight', 'grunt', 'wolf', 'shaman', 'brute', 'runner'];
    const def = this.content.enemies[order[this.spawnCount++ % order.length]];
    if (!def) return;
    const route = def.boat && this.level.boatRoute ? this.level.boatRoute : this.level.path;
    const walker = def.boat && !this.level.boatRoute ? { ...def, boat: false } : { ...def, stealth: false };
    this.walkers.push(new Enemy(this, walker, pathPoints(route), 1));
  }
}
