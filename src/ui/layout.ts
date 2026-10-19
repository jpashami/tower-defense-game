import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config/constants';

/**
 * Screen layout for wide screens such as phones held sideways.
 *
 * Every scene is designed for an 800x480 world. On screens wider than that
 * (phones are often twice as wide as tall), the canvas grows sideways instead
 * of leaving black bars: the battle map stays on the left and the HUD spreads
 * into the extra width, while other screens stay centred.
 */

/** The widest canvas we use; beyond this the game would just look stretched out. */
const MAX_W = 1120;

/** Current canvas width in game pixels (height is always GAME_H). */
export const view = { width: GAME_W };

/** Canvas width that fills a window of this shape without bars, within limits. */
export function widthFor(windowW: number, windowH: number): number {
  if (windowW <= 0 || windowH <= 0) return GAME_W;
  const w = Math.round((GAME_H * windowW) / windowH / 2) * 2;
  return Phaser.Math.Clamp(w, GAME_W, MAX_W);
}

/** Extra width on each side when an 800-wide screen is centred. */
export const sideMargin = (): number => (view.width - GAME_W) / 2;

/**
 * Keeps a scene's 800-wide content centred on the canvas, now and after the
 * screen changes shape. Pointer world coordinates follow the camera.
 */
export function centreScene(scene: Phaser.Scene): void {
  const apply = () => scene.cameras.main.setScroll(-sideMargin(), 0);
  apply();
  scene.scale.on(Phaser.Scale.Events.RESIZE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, apply));
}

/** A rectangle wide enough to dim or block the whole canvas, whatever its width. */
export function fullScreenRect(scene: Phaser.Scene, color: number, alpha: number): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(-GAME_W, 0, GAME_W * 3, GAME_H, color, alpha).setOrigin(0);
}
