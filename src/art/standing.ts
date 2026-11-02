import type Phaser from 'phaser';
import { SQUASH } from '../config/view';

/**
 * Makes a standing version of a flat, top-down sprite for the angled view: the picture is
 * squashed to the ground's slant and given a darker side face `depth` pixels tall under
 * its bottom edge, like a block sitting on the map. Soft shadow pixels move down with
 * the face so the shadow stays on the ground. Built once per texture from its pixels, so
 * it works for a family version's own drawings too.
 */
export function standingTexture(scene: Phaser.Scene, key: string, depth: number): string {
  const out = `${key}__stand${depth}`;
  if (scene.textures.exists(out)) return out;
  const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const w = src.width;
  const h = src.height;
  const read = document.createElement('canvas');
  read.width = w;
  read.height = h;
  const rc = read.getContext('2d');
  if (!rc) return key;
  rc.drawImage(src, 0, 0);
  const data = rc.getImageData(0, 0, w, h).data;
  const sh = Math.max(1, Math.round(h * SQUASH));
  const tex = scene.textures.createCanvas(out, w, sh + depth);
  if (!tex) return key;
  const ctx = tex.getContext();
  const img = ctx.createImageData(w, sh + depth);
  const put = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    if (y < 0 || y >= sh + depth) return;
    const i = (y * w + x) * 4;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = a;
  };
  for (let x = 0; x < w; x++) {
    let bottom = -1;
    let body: [number, number, number] | null = null;
    let outline: [number, number, number] = [26, 28, 44];
    for (let sy = 0; sy < sh; sy++) {
      const y = Math.min(h - 1, Math.floor((sy + 0.5) / SQUASH));
      const i = (y * w + x) * 4;
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a === 0) continue;
      if (a < 255) {
        // Soft shadow: it belongs on the ground, under the face.
        put(x, sy + depth, r, g, b, a);
        continue;
      }
      put(x, sy, r, g, b, a);
      bottom = sy;
      // Dark pixels are the outline; the face takes its colour from the body above it.
      if (r + g + b < 120) outline = [r, g, b];
      else body = [r, g, b];
    }
    if (bottom < 0 || depth === 0) continue;
    const [br, bg, bb] = body ?? outline;
    for (let k = 1; k <= depth; k++) {
      if (k === depth) put(x, bottom + k, outline[0], outline[1], outline[2], 255);
      else put(x, bottom + k, Math.round(br * 0.55), Math.round(bg * 0.55), Math.round(bb * 0.55), 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return out;
}
