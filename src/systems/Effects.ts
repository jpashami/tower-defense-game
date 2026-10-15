import Phaser from 'phaser';
import { DEPTH, FONT } from '../config/constants';

/** Text that rises and fades, e.g. "+5" gold. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffcd75'): void {
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: '8px', color, stroke: '#1a1c2c', strokeThickness: 3 })
    .setOrigin(0.5)
    .setDepth(DEPTH.banner);
  scene.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
}

/** Square pixels flying outward. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 8, distance = 16): void {
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
  const g = scene.add.graphics({ x, y }).setDepth(DEPTH.effect);
  g.lineStyle(2, color, 1);
  g.strokeCircle(0, 0, radius);
  g.setScale(0.2);
  scene.tweens.add({ targets: g, scale: 1, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
}

/** Big centred message over the map. */
export function banner(scene: Phaser.Scene, x: number, y: number, text: string, color = '#f4f4f4'): void {
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
