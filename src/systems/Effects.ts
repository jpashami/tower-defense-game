import Phaser from 'phaser';
import { DEPTH, FONT } from '../config/constants';

/** Visual effects can be switched off for headless test runs (see src/dev/autoplay.ts). */
export const fx = { enabled: true };

/** Text that rises and fades, e.g. "+5" gold. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffcd75'): void {
  if (!fx.enabled) return;
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: '8px', color, stroke: '#1a1c2c', strokeThickness: 3 })
    .setOrigin(0.5)
    .setDepth(DEPTH.banner);
  scene.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
}

/** Square pixels flying outward. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 8, distance = 16): void {
  if (!fx.enabled) return;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const d = distance * (0.6 + Math.random() * 0.6);
    const p = scene.add.image(x, y, 'px').setTint(color).setDepth(DEPTH.effect);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * d,
      y: y + Math.sin(angle) * d,
      alpha: 0,
      duration: 300 + Math.random() * 200,
      ease: 'Quad.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}

/** An expanding ring, for splash and frost hits. */
export function ring(scene: Phaser.Scene, x: number, y: number, radius: number, color: number): void {
  if (!fx.enabled) return;
  const g = scene.add.graphics({ x, y }).setDepth(DEPTH.effect);
  g.lineStyle(2, color, 1);
  g.strokeCircle(0, 0, radius);
  g.setScale(0.2);
  scene.tweens.add({ targets: g, scale: 1, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
}

/** Big centred message over the map. */
export function banner(scene: Phaser.Scene, x: number, y: number, text: string, color = '#f4f4f4'): void {
  if (!fx.enabled) return;
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: '16px', color, stroke: '#1a1c2c', strokeThickness: 6, align: 'center' })
    .setOrigin(0.5)
    .setDepth(DEPTH.banner)
    .setScale(0.6)
    .setAlpha(0);
  scene.tweens.chain({
    targets: t,
    tweens: [
      { scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' },
      { alpha: 0, y: y - 12, duration: 400, delay: 1100 },
    ],
    onComplete: () => t.destroy(),
  });
}

/** A jagged electric bolt through a chain of points that flickers out. */
export function lightningBolt(scene: Phaser.Scene, points: { x: number; y: number }[]): void {
  if (!fx.enabled) return;
  const g = scene.add.graphics().setDepth(DEPTH.effect);
  const draw = (width: number, color: number, alpha: number) => {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      // Two random kinks per segment.
      for (const t of [0.33, 0.66]) {
        const nx = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 10;
        const ny = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 10;
        g.lineTo(nx, ny);
      }
      g.lineTo(b.x, b.y);
    }
    g.strokePath();
  };
  draw(4, 0x41a6f6, 0.5);
  draw(2, 0xf4f4f4, 1);
  scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
}

/** Little green plus signs rising off a healed enemy. */
export function healSparkle(scene: Phaser.Scene, x: number, y: number): void {
  if (!fx.enabled) return;
  const t = scene.add
    .text(x + (Math.random() - 0.5) * 10, y - 8, '+', { fontFamily: FONT, fontSize: '8px', color: '#a7f070', stroke: '#1a1c2c', strokeThickness: 2 })
    .setOrigin(0.5)
    .setDepth(DEPTH.effect);
  scene.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 600, onComplete: () => t.destroy() });
}

/** A meteor falling onto a spot (visual only; the game applies the damage when it lands). */
export function meteorFall(scene: Phaser.Scene, x: number, y: number, radius: number, seconds: number): void {
  if (!fx.enabled) return;
  const m = scene.add.image(x - 120, y - 160, 'meteor').setDepth(DEPTH.banner).setScale(1.5);
  const mark = scene.add.graphics().setDepth(DEPTH.range);
  mark.lineStyle(2, 0xef7d57, 0.8).strokeCircle(x, y, radius);
  scene.tweens.add({
    targets: m,
    x,
    y,
    duration: seconds * 1000,
    ease: 'Quad.easeIn',
    onComplete: () => {
      m.destroy();
      mark.destroy();
    },
  });
}

/** The explosion where a meteor lands. */
export function meteorImpact(scene: Phaser.Scene, x: number, y: number, radius: number): void {
  if (!fx.enabled) return;
  ring(scene, x, y, radius, 0xef7d57);
  ring(scene, x, y, radius * 0.6, 0xffcd75);
  burst(scene, x, y, 0xef7d57, 18, radius);
  burst(scene, x, y, 0x566c86, 10, radius * 0.6);
  scene.cameras.main.shake(180, 0.008);
}

/** A quick line from an attacker to what it hits (enemies striking towers). */
export function strike(scene: Phaser.Scene, from: { x: number; y: number }, to: { x: number; y: number }, color = 0xb13e53): void {
  if (!fx.enabled) return;
  const g = scene.add.graphics().setDepth(DEPTH.effect);
  g.lineStyle(2, color, 1).lineBetween(from.x, from.y, to.x, to.y);
  scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
}

/** A puff where an enemy vanishes and reappears (teleport). */
export function puff(scene: Phaser.Scene, x: number, y: number, color = 0xc27bc2): void {
  if (!fx.enabled) return;
  ring(scene, x, y, 14, color);
  burst(scene, x, y, color, 8, 14);
}
