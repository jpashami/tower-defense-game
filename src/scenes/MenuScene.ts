import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, MAP_H, MAP_W } from '../config/constants';
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

    const t = title(120, 'PIXEL TOWER\nDEFENCE', 32, '#ffcd75');
    t.setLineSpacing(12);
    this.tweens.add({ targets: t, y: 126, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    title(222, 'Hold the castle for 10 waves', 8, '#94b0c2');

    const play = new Button(this, {
      x: cx - 80,
      y: 260,
      w: 160,
      h: 36,
      label: 'PLAY',
      variant: 'primary',
      depth: 21,
      onClick: () => this.scene.start('Game'),
    });
    play.label?.setFontSize(16);

    title(338, 'Click a tower in the shop, then a grass tile.\nClick a built tower to upgrade or sell it.', 8, '#f4f4f4').setLineSpacing(8);
    title(386, 'KEYS  1-3 build   U upgrade   S sell\nSPACE next wave   F speed   P pause   ESC cancel', 8, '#566c86').setLineSpacing(8);

    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('Game'));
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
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
