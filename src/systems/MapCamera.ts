import Phaser from 'phaser';
import { MAP_H, MAP_W } from '../config/constants';

const MAX_ZOOM = 2.5;
/** A finger that moves further than this (screen pixels) is dragging, not tapping. */
const DRAG_THRESHOLD = 10;
/** Minimap size in screen pixels (its longer side). */
const MINIMAP_SIZE = 112;
const MINIMAP_MARGIN = 6;

/**
 * Lets the player zoom into the battle map: pinch with two fingers or use the
 * mouse wheel, and drag with one finger (or the mouse) to look around while zoomed in.
 * The camera only covers the map, so the HUD never moves. Maps bigger than the
 * screen start zoomed out to fit and get a minimap in the corner; tap it to jump.
 */
export class MapCamera {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private readonly downAt = new Map<number, { x: number; y: number }>();
  /** Pointers that dragged or pinched, so lifting them is not a tap. */
  private readonly gestured = new Set<number>();
  private pinch: { dist: number; zoom: number; world: { x: number; y: number } } | null = null;
  private readonly minZoom: number;
  private mini: Phaser.Cameras.Scene2D.Camera | null = null;
  private miniFrame: Phaser.GameObjects.Graphics | null = null;
  private miniRect = new Phaser.Geom.Rectangle();
  private miniLine = 6;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldW = MAP_W,
    private readonly worldH = MAP_H,
  ) {
    this.cam = scene.cameras.main;
    this.minZoom = Math.min(1, MAP_W / worldW, MAP_H / worldH);
    this.cam.setViewport(0, 0, MAP_W, MAP_H).setZoom(this.minZoom);
    this.clamp();
    // Two fingers at once.
    scene.input.addPointer(1);
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (p.x >= MAP_W) return;
      this.zoomAt(this.cam.zoom * (dy > 0 ? 0.85 : 1 / 0.85), p.x, p.y);
    });
    if (this.minZoom < 1) this.addMinimap();
  }

  get zoomed(): boolean {
    return this.cam.zoom > this.minZoom + 0.01;
  }

  /** Whether a screen point is on the minimap (only shown while zoomed in; zoomed out, the whole map is in view). */
  onMinimap(x: number, y: number): boolean {
    return this.mini !== null && this.mini.visible && this.miniRect.contains(x, y);
  }

  /** Centres the view on the map point under a minimap tap. */
  jumpFromMinimap(x: number, y: number): void {
    if (!this.mini) return;
    const wx = ((x - this.miniRect.x) / this.miniRect.width) * this.worldW;
    const wy = ((y - this.miniRect.y) / this.miniRect.height) * this.worldH;
    if (!this.zoomed) this.cam.setZoom(Math.min(MAX_ZOOM, 1));
    this.placeWorldAt({ x: wx, y: wy }, this.cam.x + this.cam.width / 2, this.cam.y + this.cam.height / 2);
  }

  /** Keeps the minimap's view box in step with the camera; call every frame. */
  update(): void {
    if (!this.miniFrame || !this.mini) return;
    this.mini.setVisible(this.zoomed);
    const v = this.cam.worldView;
    this.miniFrame.clear().lineStyle(this.miniLine, 0xf4f4f4, 1).strokeRect(v.x, v.y, v.width, v.height);
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
      const zoom = Phaser.Math.Clamp((this.pinch.zoom * dist) / this.pinch.dist, this.minZoom, MAX_ZOOM);
      this.cam.setZoom(zoom);
      // Keep the spot between the fingers under the fingers.
      this.placeWorldAt(this.pinch.world, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return true;
    }
    const start = this.downAt.get(p.id)!;
    if (!this.gestured.has(p.id) && Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD && this.canPan()) {
      this.gestured.add(p.id);
    }
    if (this.gestured.has(p.id) && this.canPan()) {
      this.cam.scrollX -= (p.x - p.prevPosition.x) / this.cam.zoom;
      this.cam.scrollY -= (p.y - p.prevPosition.y) / this.cam.zoom;
      this.clamp();
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

  /** There is more map than fits on screen right now, so dragging moves the view. */
  get pannable(): boolean {
    return this.canPan();
  }

  /** There is more map than fits on screen. */
  private canPan(): boolean {
    return this.worldW * this.cam.zoom > MAP_W + 1 || this.worldH * this.cam.zoom > MAP_H + 1;
  }

  private activeFingers(): Phaser.Input.Pointer[] {
    return this.scene.input.manager.pointers.filter((q) => q.isDown && this.downAt.has(q.id));
  }

  private zoomAt(zoom: number, sx: number, sy: number): void {
    const world = this.worldAt(sx, sy);
    this.cam.setZoom(Phaser.Math.Clamp(zoom, this.minZoom, MAX_ZOOM));
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

  /** Scrolls so a map point sits under a screen point, then keeps the view on the map. */
  private placeWorldAt(world: { x: number; y: number }, sx: number, sy: number): void {
    const { cam } = this;
    cam.scrollX = world.x - (cam.width * (1 - 1 / cam.zoom)) / 2 - (sx - cam.x) / cam.zoom;
    cam.scrollY = world.y - (cam.height * (1 - 1 / cam.zoom)) / 2 - (sy - cam.y) / cam.zoom;
    this.clamp();
  }

  /**
   * Keeps the view on the map. Along a side where the whole map fits, it is centred;
   * Phaser's own camera bounds would push it into a corner instead.
   */
  private clamp(): void {
    const { cam } = this;
    const fix = (scroll: number, size: number, world: number): number => {
      const visible = size / cam.zoom;
      const offset = (size - visible) / 2;
      if (world <= visible) return (world - visible) / 2 - offset;
      return Phaser.Math.Clamp(scroll + offset, 0, world - visible) - offset;
    };
    cam.scrollX = fix(cam.scrollX, cam.width, this.worldW);
    cam.scrollY = fix(cam.scrollY, cam.height, this.worldH);
  }

  /** A second camera showing the whole map small in the top-right corner, with the view marked. */
  private addMinimap(): void {
    const scale = MINIMAP_SIZE / Math.max(this.worldW, this.worldH);
    const w = Math.round(this.worldW * scale);
    const h = Math.round(this.worldH * scale);
    const x = MAP_W - w - MINIMAP_MARGIN;
    const y = MINIMAP_MARGIN;
    this.miniRect.setTo(x, y, w, h);
    this.mini = this.scene.cameras
      .add(x, y, w, h)
      .setZoom(scale)
      .setBackgroundColor(0x1a1c2c)
      .centerOn(this.worldW / 2, this.worldH / 2);
    this.mini.setName('minimap');
    this.miniLine = 2 / scale;
    this.miniFrame = this.scene.add.graphics().setDepth(1000);
    this.cam.ignore(this.miniFrame);
  }
}
