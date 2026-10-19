import Phaser from 'phaser';
import { MAP_H, MAP_W } from '../config/constants';

const MAX_ZOOM = 2.5;
/** A finger that moves further than this (screen pixels) is dragging, not tapping. */
const DRAG_THRESHOLD = 10;

/**
 * Lets the player zoom into the battle map: pinch with two fingers or use the
 * mouse wheel, and drag with one finger to look around while zoomed in.
 * The camera only covers the map, so the HUD never moves.
 */
export class MapCamera {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private readonly downAt = new Map<number, { x: number; y: number }>();
  /** Pointers that dragged or pinched, so lifting them is not a tap. */
  private readonly gestured = new Set<number>();
  private pinch: { dist: number; zoom: number; world: { x: number; y: number } } | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
    this.cam.setViewport(0, 0, MAP_W, MAP_H).setBounds(0, 0, MAP_W, MAP_H).setZoom(1);
    // Two fingers at once.
    scene.input.addPointer(1);
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (p.x >= MAP_W) return;
      this.zoomAt(this.cam.zoom * (dy > 0 ? 0.85 : 1 / 0.85), p.x, p.y);
    });
  }

  get zoomed(): boolean {
    return this.cam.zoom > 1.01;
  }

  /** Call from pointerdown on the map. */
  down(p: Phaser.Input.Pointer): void {
    this.downAt.set(p.id, { x: p.x, y: p.y });
    const fingers = this.activeFingers();
    if (fingers.length === 2) {
      const [a, b] = fingers;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.pinch = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: this.cam.zoom, world: this.worldAt(mid.x, mid.y) };
      fingers.forEach((f) => this.gestured.add(f.id));
    }
  }

  /** Call from pointermove. Returns true when the move was a pan or pinch, not a hover. */
  move(p: Phaser.Input.Pointer): boolean {
    if (!this.downAt.has(p.id) || !p.isDown) return false;
    if (this.pinch) {
      const fingers = this.activeFingers();
      if (fingers.length < 2) return true;
      const [a, b] = fingers;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const zoom = Phaser.Math.Clamp((this.pinch.zoom * dist) / this.pinch.dist, 1, MAX_ZOOM);
      this.cam.setZoom(zoom);
      // Keep the spot between the fingers under the fingers.
      this.placeWorldAt(this.pinch.world, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return true;
    }
    const start = this.downAt.get(p.id)!;
    if (!this.gestured.has(p.id) && Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD && this.zoomed) {
      this.gestured.add(p.id);
    }
    if (this.gestured.has(p.id) && this.zoomed) {
      this.cam.scrollX -= (p.x - p.prevPosition.x) / this.cam.zoom;
      this.cam.scrollY -= (p.y - p.prevPosition.y) / this.cam.zoom;
      return true;
    }
    return false;
  }

  /** Call from pointerup. Returns true if this finger was a tap (not a drag or pinch). */
  up(p: Phaser.Input.Pointer): boolean {
    const wasTap = this.downAt.has(p.id) && !this.gestured.has(p.id);
    this.downAt.delete(p.id);
    this.gestured.delete(p.id);
    if (this.activeFingers().length < 2) this.pinch = null;
    return wasTap;
  }

  private activeFingers(): Phaser.Input.Pointer[] {
    return this.scene.input.manager.pointers.filter((q) => q.isDown && this.downAt.has(q.id));
  }

  private zoomAt(zoom: number, sx: number, sy: number): void {
    const world = this.worldAt(sx, sy);
    this.cam.setZoom(Phaser.Math.Clamp(zoom, 1, MAX_ZOOM));
    this.placeWorldAt(world, sx, sy);
  }

  /** The map point under a screen point (camera zooms around its centre). */
  private worldAt(sx: number, sy: number): { x: number; y: number } {
    const { cam } = this;
    return {
      x: cam.scrollX + (cam.width * (1 - 1 / cam.zoom)) / 2 + (sx - cam.x) / cam.zoom,
      y: cam.scrollY + (cam.height * (1 - 1 / cam.zoom)) / 2 + (sy - cam.y) / cam.zoom,
    };
  }

  /** Scrolls so a map point sits under a screen point; the camera bounds keep it on the map. */
  private placeWorldAt(world: { x: number; y: number }, sx: number, sy: number): void {
    const { cam } = this;
    cam.scrollX = world.x - (cam.width * (1 - 1 / cam.zoom)) / 2 - (sx - cam.x) / cam.zoom;
    cam.scrollY = world.y - (cam.height * (1 - 1 / cam.zoom)) / 2 - (sy - cam.y) / cam.zoom;
  }
}
