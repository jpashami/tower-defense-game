import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config/constants';
import { DIFFICULTIES, type DifficultyKey } from '../config/difficulty';
import { Button } from '../ui/Button';

interface GameOverData {
  won: boolean;
  wave: number;
  lives: number;
  difficulty: DifficultyKey;
}

/** Overlay shown on top of the paused game when it ends. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const cx = GAME_W / 2;
    // Full-screen blocker so clicks don't reach the game underneath.
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1a1c2c, 0.75).setOrigin(0).setInteractive();

    const style = (size: number, color: string) => ({
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      stroke: '#1a1c2c',
      strokeThickness: size / 2,
      align: 'center',
    });
    const title = this.add
      .text(cx, 150, data.won ? 'VICTORY!' : 'GAME OVER', style(32, data.won ? '#ffcd75' : '#b13e53'))
      .setOrigin(0.5)
      .setScale(0.5);
    this.tweens.add({ targets: title, scale: 1, duration: 400, ease: 'Back.easeOut' });

    const level = DIFFICULTIES[data.difficulty];
    const sub = data.won
      ? `The castle stands!\n${data.lives} lives left.`
      : `The castle fell on wave ${data.wave}.`;
    this.add.text(cx, 206, sub, style(8, '#f4f4f4')).setOrigin(0.5).setLineSpacing(8);
    this.add.text(cx, 240, `DIFFICULTY: ${level.name.toUpperCase()}`, style(8, level.color)).setOrigin(0.5);

    const restart = () => {
      this.scene.stop('UI');
      this.scene.stop('Game');
      this.scene.start('Game', { difficulty: data.difficulty });
    };
    new Button(this, { x: cx - 80, y: 262, w: 160, h: 32, label: 'PLAY AGAIN', variant: 'primary', onClick: restart });
    new Button(this, {
      x: cx - 80,
      y: 304,
      w: 160,
      h: 28,
      label: 'MAIN MENU',
      onClick: () => {
        this.scene.stop('UI');
        this.scene.stop('Game');
        this.scene.start('Menu');
      },
    });
    this.input.keyboard?.once('keydown-ENTER', restart);
  }
}
