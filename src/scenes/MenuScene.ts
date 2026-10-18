import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, MAP_H, MAP_W } from '../config/constants';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  loadDifficulty,
  saveDifficulty,
  type DifficultyKey,
} from '../config/difficulty';
import { ENEMIES, type EnemyKey } from '../config/enemies';
import { buildGrid, pathPoints } from '../config/map';
import { Enemy } from '../entities/Enemy';
import { renderMap } from '../systems/MapRenderer';
import { Button } from '../ui/Button';

/** Title screen: the map with enemies wandering behind a Play button. */
export class MenuScene extends Phaser.Scene {
  private walkers: Enemy[] = [];
  private spawnTimer = 0;
  private spawnCount = 0;
  private difficulty: DifficultyKey = 'normal';
  private diffButtons: Button[] = [];
  private diffText!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.walkers = [];
    this.spawnTimer = 0;
    this.spawnCount = 0;
    renderMap(this, buildGrid());
    this.add.rectangle(MAP_W, 0, GAME_W - MAP_W, MAP_H, 0x1a1c2c).setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1a1c2c, 0.55).setOrigin(0).setDepth(20);

    const cx = GAME_W / 2;
    const title = (y: number, text: string, size: number, color: string) =>
      this.add
        .text(cx, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1a1c2c', strokeThickness: size / 2, align: 'center' })
        .setOrigin(0.5)
        .setDepth(21);

    const t = title(104, 'PIXEL TOWER\nDEFENCE', 32, '#ffcd75');
    t.setLineSpacing(12);
    this.tweens.add({ targets: t, y: 110, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    title(196, 'Hold the castle for 10 waves', 8, '#94b0c2');

    // Difficulty picker: three toggle buttons and a line describing the current one.
    this.difficulty = loadDifficulty();
    const bw = 96;
    const gap = 8;
    const left = cx - (bw * 3 + gap * 2) / 2;
    this.diffButtons = DIFFICULTY_ORDER.map(
      (key, i) =>
        new Button(this, {
          x: left + i * (bw + gap),
          y: 220,
          w: bw,
          h: 24,
          label: DIFFICULTIES[key].name.toUpperCase(),
          depth: 21,
          onClick: () => this.setDifficulty(key),
        }),
    );
    this.diffText = title(260, '', 8, '#f4f4f4');
    this.setDifficulty(this.difficulty);

    const play = new Button(this, {
      x: cx - 168,
      y: 282,
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
      y: 282,
      w: 160,
      h: 36,
      label: 'CREATE',
      variant: 'accent',
      depth: 21,
      onClick: () => this.scene.start('Editor'),
    });
    create.label?.setFontSize(16);

    title(352, 'Click a tower in the shop, then a grass tile.\nClick a built tower to upgrade or sell it.', 8, '#f4f4f4').setLineSpacing(8);
    title(400, 'KEYS  1-3 build   U upgrade   S sell\nSPACE next wave   F speed   P pause   ESC cancel', 8, '#566c86').setLineSpacing(8);

    const kb = this.input.keyboard;
    kb?.once('keydown-ENTER', () => this.startGame());
    kb?.once('keydown-SPACE', () => this.startGame());
    kb?.on('keydown-LEFT', () => this.stepDifficulty(-1));
    kb?.on('keydown-RIGHT', () => this.stepDifficulty(1));
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

  private startGame(): void {
    this.scene.start('Game', { difficulty: this.difficulty });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const order: EnemyKey[] = ['grunt', 'grunt', 'runner', 'grunt', 'brute', 'runner'];
      const key = order[this.spawnCount++ % order.length];
      this.walkers.push(new Enemy(this, ENEMIES[key], pathPoints(), 1));
      this.spawnTimer = 1.3;
    }
    for (const w of this.walkers) w.step(dt);
    this.walkers = this.walkers.filter((w) => {
      if (w.escaped) w.destroy();
      return !w.escaped;
    });
  }
}
