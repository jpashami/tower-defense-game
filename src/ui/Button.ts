import Phaser from 'phaser';
import { FONT } from '../config/constants';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'accent';

export interface ButtonOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  variant?: ButtonVariant;
  depth?: number;
  onClick: () => void;
}

const COLORS: Record<ButtonVariant, { fill: number; light: number; dark: number }> = {
  default: { fill: 0x333c57, light: 0x566c86, dark: 0x1a1c2c },
  primary: { fill: 0x38b764, light: 0xa7f070, dark: 0x257179 },
  danger: { fill: 0xb13e53, light: 0xef7d57, dark: 0x5d275d },
  accent: { fill: 0x3b5dc9, light: 0x41a6f6, dark: 0x29366f },
};
const ACTIVE = { fill: 0x257179, light: 0x73eff7, dark: 0x1a1c2c };
const DISABLED = { fill: 0x262b3e, light: 0x333c57, dark: 0x1a1c2c };

/** A bevelled pixel button. Position is its top-left corner. */
export class Button {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly label?: Phaser.GameObjects.Text;

  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly variant: ButtonVariant;
  private enabled = true;
  private active = false;
  private hovered = false;
  private visible = true;

  constructor(scene: Phaser.Scene, opts: ButtonOptions) {
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w;
    this.h = opts.h;
    this.variant = opts.variant ?? 'default';
    this.gfx = scene.add.graphics();
    if (opts.label !== undefined) {
      this.label = scene.add
        .text(opts.x + opts.w / 2, opts.y + opts.h / 2 + 1, opts.label, {
          fontFamily: FONT,
          fontSize: '8px',
          color: '#f4f4f4',
        })
        .setOrigin(0.5);
    }
    this.zone = scene.add.zone(opts.x, opts.y, opts.w, opts.h).setOrigin(0).setInteractive({ useHandCursor: true });
    this.zone.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
    });
    this.zone.on('pointerout', () => {
      this.hovered = false;
      this.redraw();
    });
    this.zone.on('pointerdown', () => {
      if (this.enabled && this.visible) opts.onClick();
    });
    if (opts.depth !== undefined) {
      this.gfx.setDepth(opts.depth);
      this.label?.setDepth(opts.depth);
      this.zone.setDepth(opts.depth);
    }
    this.redraw();
  }

  setEnabled(enabled: boolean): this {
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      this.redraw();
    }
    return this;
  }

  /** Highlighted state, e.g. the tower type currently being placed. */
  setActive(active: boolean): this {
    if (active !== this.active) {
      this.active = active;
      this.redraw();
    }
    return this;
  }

  setLabel(text: string): this {
    this.label?.setText(text);
    return this;
  }

  setVisible(visible: boolean): this {
    if (visible !== this.visible) {
      this.visible = visible;
      this.gfx.setVisible(visible);
      this.label?.setVisible(visible);
      if (this.zone.input) this.zone.input.enabled = visible;
    }
    return this;
  }

  destroy(): void {
    this.gfx.destroy();
    this.label?.destroy();
    this.zone.destroy();
  }

  private redraw(): void {
    const c = !this.enabled ? DISABLED : this.active ? ACTIVE : COLORS[this.variant];
    const { x, y, w, h } = this;
    const g = this.gfx;
    g.clear();
    g.fillStyle(0x0f1018, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(c.fill, 1).fillRect(x, y, w, h);
    g.fillStyle(c.light, 1).fillRect(x, y, w, 2).fillRect(x, y, 2, h);
    g.fillStyle(c.dark, 1).fillRect(x, y + h - 2, w, 2).fillRect(x + w - 2, y, 2, h);
    if (this.hovered && this.enabled) g.fillStyle(0xffffff, 0.12).fillRect(x, y, w, h);
    this.label?.setColor(this.enabled ? '#f4f4f4' : '#566c86');
  }
}
