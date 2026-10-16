/**
 * A tiny pixel-art canvas. Sprites are built from simple shapes,
 * then given a dark outline, and exported as a palette-character grid
 * (see palette.ts) for makePixelTexture.
 */

/** A region test: is pixel (x, y) inside the shape? */
export type Shape = (x: number, y: number) => boolean;

// Pixel centres sit at +0.5, so a disc centred on 16 in a 32px sprite is symmetric.
export const inDisc =
  (cx: number, cy: number, r: number): Shape =>
  (x, y) =>
    (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;

export const inEllipse =
  (cx: number, cy: number, rx: number, ry: number): Shape =>
  (x, y) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

export const inRect =
  (x0: number, y0: number, w: number, h: number): Shape =>
  (x, y) =>
    x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;

export const inDiamond =
  (cx: number, cy: number, rx: number, ry: number): Shape =>
  (x, y) =>
    Math.abs(x + 0.5 - cx) / rx + Math.abs(y + 0.5 - cy) / ry <= 1;

/** Pixels inside `a` but not inside `b` (e.g. the shaded crescent of a disc). */
export const minus =
  (a: Shape, b: Shape): Shape =>
  (x, y) =>
    a(x, y) && !b(x, y);

/** Deterministic random numbers so art is identical every run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Palette character used for soft drop shadows; never outlined. */
export const SHADOW = 'z';

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  private readonly px: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array<string | null>(w * h).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  set(x: number, y: number, c: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
    return this;
  }

  /** Fills every pixel of the shape. */
  fill(shape: Shape, c: string): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (shape(x, y)) this.set(x, y, c);
    return this;
  }

  /** Recolours pixels of the shape that are already drawn, optionally only those of one colour. */
  paint(shape: Shape, c: string, onlyOn?: string): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const cur = this.get(x, y);
        if (cur !== null && cur !== SHADOW && shape(x, y) && (onlyOn === undefined || cur === onlyOn)) this.set(x, y, c);
      }
    }
    return this;
  }

  /** Fills only the empty pixels of the shape (for shadows behind everything). */
  under(shape: Shape, c: string): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y) === null && shape(x, y)) this.set(x, y, c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    return this.fill(inRect(x, y, w, h), c);
  }

  disc(cx: number, cy: number, r: number, c: string): this {
    return this.fill(inDisc(cx, cy, r), c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): this {
    return this.fill(inEllipse(cx, cy, rx, ry), c);
  }

  diamond(cx: number, cy: number, rx: number, ry: number, c: string): this {
    return this.fill(inDiamond(cx, cy, rx, ry), c);
  }

  points(pts: [number, number][], c: string): this {
    for (const [x, y] of pts) this.set(x, y, c);
    return this;
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);
    const dx = Math.abs(xe - x);
    const dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x, y, c);
      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  /** Copies the left half onto the right half, mirrored. */
  mirrorX(): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < Math.floor(this.w / 2); x++) {
        const c = this.get(x, y);
        if (c !== null) this.set(this.w - 1 - x, y, c);
      }
    }
    return this;
  }

  /** Adds a 1px outline around everything drawn so far (shadows excluded). */
  outline(c = '0'): this {
    const solid = (x: number, y: number) => {
      const v = this.get(x, y);
      return v !== null && v !== SHADOW;
    };
    const edge: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) edge.push([x, y]);
      }
    }
    return this.points(edge, c);
  }

  /** Exports rows of palette characters; '.' is transparent. */
  grid(): string[] {
    const rows: string[] = [];
    for (let y = 0; y < this.h; y++) {
      let row = '';
      for (let x = 0; x < this.w; x++) row += this.get(x, y) ?? '.';
      rows.push(row);
    }
    return rows;
  }
}
