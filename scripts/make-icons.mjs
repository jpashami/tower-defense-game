// Draws the app icons from the game's own pixel art: an archer tower on a grass tile.
// Run with `npm run icons`. Writes PWA icons to public/icons and, once the Android
// project exists, launcher icons to android/app/src/main/res.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

// The art modules are TypeScript with extensionless imports (as Vite expects); Node strips the
// types itself but needs telling that './draw' means './draw.ts'.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(spec, ctx, next) {
        if (/^\\.\\.?\\//.test(spec) && !/\\.[a-z]+$/.test(spec)) return next(spec + '.ts', ctx);
        return next(spec, ctx);
      }`),
);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { buildSprites, grassTile } = await import('../src/art/sprites.ts');
const { PALETTE } = await import('../src/art/palette.ts');

const sprites = buildSprites();
const grass = grassTile(3);

/** Palette character to [r, g, b, a] (0-255). */
function rgba(ch) {
  if (ch === '.' || ch === ' ' || ch === undefined) return null;
  const c = PALETTE[ch];
  if (c.startsWith('#')) return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
  const m = c.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  return [+m[1], +m[2], +m[3], Math.round(+m[4] * 255)];
}

/** Tower head faces right in the game; turn it to face up, as the build preview does. */
function rotateLeft(grid) {
  const n = grid.length;
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => grid[x][n - 1 - y]).join(''));
}

const ART = [sprites.base_archer.grid, rotateLeft(sprites.head_archer.grid)];

class Image {
  constructor(size, height = size) {
    this.size = size;
    this.w = size;
    this.h = height;
    this.px = new Uint8Array(size * height * 4);
  }

  /** Paints every pixel one colour. */
  fill(c) {
    for (let i = 0; i < this.w * this.h; i++) this.px.set(c, i * 4);
  }

  /** Alpha-blends one colour over a square block. */
  block(x0, y0, s, c) {
    if (!c) return;
    const a = c[3] / 255;
    for (let y = Math.max(0, y0); y < Math.min(this.h, y0 + s); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.w, x0 + s); x++) {
        const i = (y * this.w + x) * 4;
        const da = this.px[i + 3] / 255;
        const oa = a + da * (1 - a);
        for (let k = 0; k < 3; k++) this.px[i + k] = Math.round((c[k] * a + this.px[i + k] * da * (1 - a)) / (oa || 1));
        this.px[i + 3] = Math.round(oa * 255);
      }
    }
  }

  /** Draws a palette grid with each cell as an s x s block, top-left at (x0, y0). */
  grid(grid, x0, y0, s) {
    grid.forEach((row, y) => [...row].forEach((ch, x) => this.block(x0 + x * s, y0 + y * s, s, rgba(ch))));
  }

  /** Fills the whole image with grass tiles at s pixels per cell, lined up with the centre. */
  grass(s) {
    const tile = 32 * s;
    const off = Math.round((this.size - tile) / 2) % tile;
    for (let ty = off - tile; ty < this.size; ty += tile) for (let tx = off - tile; tx < this.size; tx += tile) this.grid(grass, tx, ty, s);
  }

  /** The tower art, centred, at s pixels per cell. */
  tower(s) {
    const ox = Math.round((this.w - 32 * s) / 2);
    const oy = Math.round((this.h - 32 * s) / 2);
    for (const g of ART) this.grid(g, ox, oy, s);
  }

  png() {
    const stride = this.w * 4 + 1;
    const raw = Buffer.alloc(stride * this.h);
    for (let y = 0; y < this.h; y++) Buffer.from(this.px.buffer, y * this.w * 4, this.w * 4).copy(raw, y * stride + 1);
    const chunk = (type, data) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const td = Buffer.concat([Buffer.from(type), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(td));
      return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function write(path, img) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, img.png());
  console.log(`  ${path} (${img.w}x${img.h})`);
}

/** Full icon: grass to the edges, tower as big as whole pixels allow. `fill` is the art's share of the width. */
function icon(size, fill = 1) {
  const s = Math.max(1, Math.floor((size * fill) / 32));
  const img = new Image(size);
  img.grass(s);
  img.tower(s);
  return img;
}

console.log('PWA icons:');
write('public/icons/favicon-32.png', icon(32));
write('public/icons/icon-192.png', icon(192, 0.75));
write('public/icons/icon-512.png', icon(512, 0.75));
// Maskable icons get cropped to a circle or squircle; keep the tower inside the middle 80%.
write('public/icons/icon-maskable-512.png', icon(512, 0.62));
write('public/icons/apple-touch-icon.png', icon(180, 0.75));

const res = 'android/app/src/main/res';
if (existsSync(join(root, res))) {
  console.log('Android launcher icons:');
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [name, d] of Object.entries(densities)) {
    const legacy = Math.round(48 * d);
    write(`${res}/mipmap-${name}/ic_launcher.png`, icon(legacy, 0.75));
    write(`${res}/mipmap-${name}/ic_launcher_round.png`, icon(legacy, 0.7));
    // Adaptive icon layers are 108dp; the launcher shows the middle 72dp and may crop to 66dp.
    const layer = Math.round(108 * d);
    const s = Math.floor((layer * 0.6) / 32);
    const fg = new Image(layer);
    fg.tower(s);
    write(`${res}/mipmap-${name}/ic_launcher_foreground.png`, fg);
    const bg = new Image(layer);
    bg.grass(s);
    write(`${res}/mipmap-${name}/ic_launcher_background.png`, bg);
  }
  // Replace Capacitor's placeholder splash screens (same sizes) with the tower on the game's dark blue.
  console.log('Android splash screens:');
  for (const dir of readdirSync(join(root, res)).filter((d) => d.startsWith('drawable'))) {
    const path = `${res}/${dir}/splash.png`;
    if (!existsSync(join(root, path))) continue;
    const head = readFileSync(join(root, path));
    const w = head.readUInt32BE(16);
    const h = head.readUInt32BE(20);
    const img = new Image(w, h);
    img.fill(rgba('0'));
    img.tower(Math.max(1, Math.floor(Math.min(w, h) / 3 / 32)));
    write(path, img);
  }
} else {
  console.log('No android/ folder yet: run `npx cap add android`, then this again for launcher icons.');
}
