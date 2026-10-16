import { PixelCanvas, SHADOW, inDiamond, inDisc, inEllipse, inRect, minus, rng } from './draw';

/**
 * All game art, built in code at 32x32 (one tile) unless noted.
 * Enemies have two walk frames: `<key>_0` and `<key>_1`.
 * Tower heads and projectiles face right; the game rotates them.
 * Characters are palette keys from palette.ts.
 */

export interface SpriteSource {
  grid: string[];
  /** Screen pixels per grid cell. */
  scale: number;
}

type Frame = 0 | 1;

// ---------------------------------------------------------------- Enemies

function grunt(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  const lUp = frame === 1 ? 2 : 0;
  const rUp = frame === 0 ? 2 : 0;

  // Legs and boots.
  p.rect(12, 23 - lUp, 3, 5, 'g').rect(11, 27 - lUp, 4, 2, 'j');
  p.rect(17, 23 - rUp, 3, 5, 'g').rect(17, 27 - rUp, 4, 2, 'j');

  // Arms (the left one swings with the stride).
  const swing = frame === 0 ? 1 : -1;
  p.rect(7, 16 + swing, 3, 6, '5').disc(8.5, 22 + swing, 1.8, '5');
  p.rect(22, 15, 3, 5, '5');

  // Spiked club gripped in the right hand.
  p.rect(24, 9, 2, 12, 'g').rect(24, 9, 1, 12, 'h');
  p.ellipse(25, 6.5, 3.5, 4.5, 'g').paint(inEllipse(24, 5.5, 1.6, 2.5), 'h');
  p.points([[22, 5], [28, 4], [28, 8], [25, 1]], 'd');
  p.disc(23.5, 19.5, 2, '5');

  // Tunic and belt.
  p.rect(10, 15, 12, 9, 'g').rect(11, 16, 3, 5, 'h');
  p.rect(10, 21, 12, 2, 'j').rect(15, 21, 2, 2, '4');

  // Head with leather cap.
  const head = inDisc(16, 9.5, 7);
  p.fill(head, '5');
  p.points([[8, 8], [7, 8], [6, 7], [8, 9], [7, 9]], '5');
  p.points([[23, 8], [24, 8], [25, 7], [23, 9], [24, 9]], '5');
  p.paint(minus(head, inDisc(15, 8.5, 6.4)), '6');
    p.paint((x, y) => head(x, y) && y <= 4, 'g');
  p.paint((x, y) => head(x, y) && y === 5, 'h');

  // Face.
  p.rect(12, 8, 2, 3, 'c').points([[13, 9], [13, 10]], '0');
  p.rect(18, 8, 2, 3, 'c').points([[18, 9], [18, 10]], '0');
  p.rect(13, 13, 6, 1, '0').points([[14, 13], [17, 13]], 'c');

  return p.outline().grid();
}

function runner(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);

  // Bat wings, flapping between frames (left side, mirrored below).
  if (frame === 0) {
    p.ellipse(7, 11, 5, 4, '1').paint(inEllipse(7, 10, 3.5, 2), 'n');
    p.points([[3, 7], [4, 6], [6, 7]], '1');
  } else {
    p.ellipse(7, 19, 5, 3, '1').paint(inEllipse(7, 19, 3.5, 1.5), 'n');
    p.points([[3, 22], [4, 23], [6, 22]], '1');
  }
  // Horns.
  p.points([[11, 6], [11, 5], [10, 4], [10, 3], [10, 2]], 'd');
  p.mirrorX();

  // Legs (alternate per frame) and tail.
  const lUp = frame === 1 ? 2 : 0;
  const rUp = frame === 0 ? 2 : 0;
  p.rect(13, 24 - lUp, 2, 5, '1');
  p.rect(17, 24 - rUp, 2, 5, '1');
  p.line(21, 22, 26, 25, '1').points([[27, 24], [27, 25], [26, 24], [28, 24]], '2');

  // Body and head.
  const body = inDisc(16, 19.5, 6);
  const head = inDisc(16, 11, 6.5);
  p.fill(body, '2').fill(head, '2');
  p.paint(minus(body, inDisc(15, 18.5, 5.4)), '1');
  p.paint(minus(head, inDisc(15, 10, 5.8)), '1');
  p.paint(inDisc(13.5, 8, 1.8), '3');
  p.paint(inDisc(13.5, 17, 1.4), '3');

  // Face.
  p.rect(12, 10, 3, 2, '4').set(14, 11, '0');
  p.rect(17, 10, 3, 2, '4').set(17, 11, '0');
  p.rect(13, 14, 6, 1, '0').points([[14, 14], [17, 14]], 'c');

  return p.outline().grid();
}

function brute(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  const lUp = frame === 1 ? 2 : 0;
  const rUp = frame === 0 ? 2 : 0;

  // Legs and boots.
  p.rect(9, 24 - lUp, 6, 5, 'f').rect(8, 28 - lUp, 7, 3, 'j');
  p.rect(17, 24 - rUp, 6, 5, 'f').rect(17, 28 - rUp, 7, 3, 'j');

  // Arms and fists.
  p.disc(5.5, 17, 4, 'n').disc(5, 23, 3.5, 'n');
  p.disc(26.5, 17, 4, 'n').disc(27, 23, 3.5, 'n');
  p.paint(inRect(0, 22, 9, 6), '1');
  p.paint(inRect(23, 22, 9, 6), '1');
  p.paint(inDisc(4, 21.5, 1.3), 'o');

  // Body with chest plate and belt.
  p.ellipse(16, 18, 10, 8, 'n');
  p.rect(9, 13, 14, 10, 'e').rect(9, 17, 14, 1, 'f').rect(15, 13, 2, 10, 'f');
  p.rect(10, 14, 4, 2, 'd').rect(18, 14, 4, 2, 'd');
  p.rect(8, 22, 16, 2, 'j').rect(15, 22, 2, 2, '4');
  p.disc(7, 13, 4, 'e').disc(25, 13, 4, 'e');
  p.paint(inDisc(6, 11.5, 1.6), 'd').paint(inDisc(24, 11.5, 1.6), 'd');

  // Head with horned helmet.
  const head = inDisc(16, 8, 7);
  p.fill(head, 'n');
  p.paint(minus(head, inDisc(15, 7, 6.3)), '1');
  p.paint((x, y) => head(x, y) && y <= 4, 'e');
  p.paint((x, y) => head(x, y) && y === 5, 'f');
  p.paint(inRect(12, 1, 3, 2), 'd');
  p.points([[9, 3], [8, 2], [7, 1], [7, 0]], 'd');
  p.points([[22, 3], [23, 2], [24, 1], [24, 0]], 'd');

  // Face.
  p.line(11, 6, 14, 7, '0').line(20, 6, 17, 7, '0');
  p.rect(12, 8, 2, 1, '4').rect(18, 8, 2, 1, '4');
  p.rect(13, 11, 6, 1, '0').points([[13, 10], [18, 10]], 'c');

  return p.outline().grid();
}

// ---------------------------------------------------------------- Towers

function shadowUnder(p: PixelCanvas, cy = 29.5, rx = 13): void {
  p.under(inEllipse(16, cy, rx, 2.5), SHADOW);
}

function baseArcher(): string[] {
  const p = new PixelCanvas(32, 32);
  p.rect(4, 5, 24, 20, 'h');
  for (const y of [9, 14, 19]) p.rect(4, y, 24, 1, 'g');
  p.points([[9, 6], [20, 11], [12, 16], [24, 21], [7, 21]], 'g');
  // Front face of the platform.
  p.rect(4, 25, 24, 3, 'g').rect(4, 27, 24, 1, 'j');
  // Corner posts.
  for (const [x, y] of [[2, 3], [25, 3], [2, 22], [25, 22]] as [number, number][]) {
    p.rect(x, y, 5, 6, 'j').rect(x + 1, y, 3, 2, 'g');
  }
  p.outline();
  shadowUnder(p);
  return p.grid();
}

function baseCannon(): string[] {
  const p = new PixelCanvas(32, 32);
  // Cylinder side, then the top face.
  p.disc(16, 17, 12, 'f');
  p.disc(16, 14, 12, 'e');
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.3;
    p.line(16 + Math.cos(a) * 8, 14 + Math.sin(a) * 8, 16 + Math.cos(a) * 11.5, 14 + Math.sin(a) * 11.5, 'f');
  }
  p.paint((x, y) => inDisc(16, 14, 12)(x, y) && x + y < 26, 'd', 'e');
  p.disc(16, 14, 7.5, 'f').disc(16, 14, 6.5, 'e');
  // Brick seams on the side.
  for (const x of [8, 13, 19, 24]) p.paint(inRect(x, 22, 1, 5), '0', 'f');
  p.outline();
  shadowUnder(p);
  return p.grid();
}

function baseFrost(): string[] {
  const p = new PixelCanvas(32, 32);
  p.disc(16, 17, 12, '8');
  p.disc(16, 14, 12, '9');
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    p.line(16, 14, 16 + Math.cos(a) * 11, 14 + Math.sin(a) * 11, 'a');
  }
  p.paint((x, y) => inDisc(16, 14, 12)(x, y) && x + y < 22, 'a', '9');
  p.disc(16, 14, 6, '8').disc(16, 14, 5, '9');
  // Little ice spikes around the rim.
  for (const [x, y] of [[5, 9], [27, 9], [6, 22], [26, 22]] as [number, number][]) p.diamond(x, y, 2, 4, 'b');
  p.outline();
  shadowUnder(p);
  return p.grid();
}

function headArcher(): string[] {
  const p = new PixelCanvas(32, 32);
  // Bow arc and pulled string.
  for (let deg = -72; deg <= 72; deg += 2) {
    const r = (deg * Math.PI) / 180;
    const x = Math.round(12 + Math.cos(r) * 11);
    const y = Math.round(16 + Math.sin(r) * 10);
    p.set(x, y, 'g').set(x - 1, y, 'h');
  }
  p.line(15, 6, 10, 16, 'd').line(10, 16, 15, 26, 'd');
  // Archer seen from above: cloak and hood.
  p.ellipse(10, 16, 5, 7, '7');
  p.disc(10, 16, 4.2, '6');
  p.paint(minus(inDisc(10, 16, 4.2), inDisc(9.3, 15.3, 3.6)), 'm');
  p.paint(inDisc(8.5, 14, 1.4), '5');
  // Arrow on the string.
  p.line(11, 16, 26, 16, 'h');
  p.points([[27, 16], [26, 15], [26, 17], [28, 16]], 'd');
  p.points([[11, 15], [11, 17], [12, 15], [12, 17]], 'c');
  return p.outline().grid();
}

function headCannon(): string[] {
  const p = new PixelCanvas(32, 32);
  p.rect(14, 12, 13, 8, 'f').rect(14, 13, 13, 2, 'e');
  p.rect(26, 11, 3, 10, 'e').rect(26, 11, 3, 1, 'd').rect(28, 13, 1, 6, '0');
  const body = inDisc(12, 16, 7);
  p.fill(body, 'e');
  p.paint(minus(body, inDisc(11, 15, 6.3)), 'f');
  p.paint(inDisc(9.5, 13, 2), 'd');
  p.points([[12, 10], [17, 14], [17, 18], [12, 22], [7, 16]], 'f');
  return p.outline().grid();
}

function headFrost(): string[] {
  const p = new PixelCanvas(32, 32);
  p.diamond(9, 19, 3, 6, '9').diamond(23, 19, 3, 6, '9');
  p.paint(inDiamond(8.5, 18, 1.5, 4), 'a').paint(inDiamond(22.5, 18, 1.5, 4), 'a');
  const crystal = inDiamond(16, 15, 7, 13);
  p.fill(crystal, 'a');
  p.paint((x, y) => crystal(x, y) && x < 16, 'b');
  p.paint(inDiamond(13, 10, 1.5, 4.5), 'c');
  p.diamond(16, 16, 2, 4, 'c');
  return p.outline('8').grid();
}

// ---------------------------------------------------------------- Projectiles

function projArcher(): string[] {
  const p = new PixelCanvas(18, 5);
  p.line(3, 2, 13, 2, 'h');
  p.points([[14, 2], [13, 1], [13, 3], [15, 2]], 'd');
  p.points([[2, 1], [3, 1], [2, 3], [3, 3], [1, 2]], 'c');
  return p.outline().grid();
}

function projCannon(): string[] {
  const p = new PixelCanvas(10, 10);
  p.disc(5, 5, 3.6, 'f').points([[3, 3], [4, 3], [3, 4]], 'd');
  return p.outline().grid();
}

function projFrost(): string[] {
  const p = new PixelCanvas(10, 10);
  p.diamond(5, 5, 3.6, 3.6, 'b').points([[4, 4], [5, 4], [4, 5]], 'c');
  return p.outline('8').grid();
}

// ---------------------------------------------------------------- Map

export function grassTile(seed: number): string[] {
  const rand = rng(seed);
  const p = new PixelCanvas(32, 32);
  p.rect(0, 0, 32, 32, '6');
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const r = rand();
      if (r < 0.035) p.set(x, y, '5');
      else if (r < 0.1) p.set(x, y, 'm');
    }
  }
  // Grass tufts.
  for (let i = 0; i < 5; i++) {
    const x = 1 + Math.floor(rand() * 30);
    const y = 3 + Math.floor(rand() * 28);
    p.points([[x - 1, y - 1], [x, y], [x + 1, y - 1]], 'm').points([[x - 1, y - 2], [x + 1, y - 2]], '5');
  }
  // Occasional flower.
  if (rand() < 0.4) {
    const x = 3 + Math.floor(rand() * 26);
    const y = 3 + Math.floor(rand() * 26);
    const petal = rand() < 0.5 ? 'c' : '4';
    p.points([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], petal).set(x, y, '3');
  }
  return p.grid();
}

export function pathTile(seed: number): string[] {
  const rand = rng(seed);
  const p = new PixelCanvas(32, 32);
  p.rect(0, 0, 32, 32, 'i');
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const r = rand();
      if (r < 0.06) p.set(x, y, 'h');
    }
  }
  // Pebbles.
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(rand() * 27);
    const y = 2 + Math.floor(rand() * 27);
    p.points([[x, y], [x + 1, y]], 'd').points([[x, y + 1], [x + 1, y + 1]], 'e');
  }
  return p.grid();
}

function tree(): string[] {
  const rand = rng(77);
  const p = new PixelCanvas(32, 32);
  p.rect(14, 18, 5, 10, 'g').rect(15, 19, 1, 8, 'h').points([[13, 27], [19, 27]], 'g');
  p.disc(16, 11, 10, 'm').disc(10.5, 14, 5.5, 'm').disc(21.5, 14, 5.5, 'm');
  p.paint(inDisc(14.5, 9, 8), '6').paint(inDisc(10, 12.5, 3.8), '6').paint(inDisc(20.5, 11, 4.2), '6');
  p.paint(inDisc(12, 6, 3), '5').paint(inDisc(19.5, 7.5, 2), '5');
  // Leaf texture.
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rand() * 32);
    const y = Math.floor(rand() * 22);
    if (p.get(x, y) === '6') p.set(x, y, 'm');
    else if (p.get(x, y) === '5') p.set(x, y, '6');
  }
  p.outline();
  shadowUnder(p, 29, 11);
  return p.grid();
}

function rock(): string[] {
  const p = new PixelCanvas(32, 32);
  p.ellipse(16.5, 21, 11, 7, 'e').ellipse(12, 17.5, 6.5, 5, 'e');
  p.paint((_x, y) => y >= 24, 'f');
  p.paint(inEllipse(12, 15.5, 4, 2.5), 'd').set(11, 14, 'c');
  p.line(19, 17, 21, 22, 'f').line(21, 22, 23, 23, 'f');
  p.outline();
  shadowUnder(p, 28.5, 12);
  return p.grid();
}

function portal(): string[] {
  const p = new PixelCanvas(32, 32);
  p.disc(16, 16, 14, 'e').disc(16, 16, 12.5, '0');
  p.paint((x, y) => minus(inDisc(16, 16, 14), inDisc(16, 16, 12.5))(x, y) && x + y < 28, 'd');
  p.disc(16, 16, 11.5, '1').disc(16, 16, 8.5, 'n').disc(16, 16, 5, 'o').disc(16, 16, 2.2, 'c');
  for (let arm = 0; arm < 2; arm++) {
    for (let t = 0; t < 40; t += 0.05) {
      const r = 2 + t * 0.3;
      if (r > 11.5) break;
      const a = t * 0.42 + arm * Math.PI;
      p.set(Math.floor(16 + Math.cos(a) * r), Math.floor(16 + Math.sin(a) * r), '0');
    }
  }
  return p.outline().grid();
}

function castle(): string[] {
  const p = new PixelCanvas(32, 32);
  p.rect(6, 11, 20, 18, 'd');
  p.rect(2, 6, 9, 23, 'd').rect(21, 6, 9, 23, 'd');
  // Battlements.
  for (const x of [2, 5, 8, 21, 24, 27]) p.rect(x, 3, 2, 3, 'd');
  for (const x of [12, 15, 18]) p.rect(x, 9, 2, 2, 'd');
  // Brick seams.
  for (let y = 8; y < 29; y += 3) {
    p.paint(inRect(0, y, 32, 1), 'e', 'd');
    for (let x = (y % 2) * 2; x < 32; x += 4) p.paint(inRect(x, y + 1, 1, 2), 'e', 'd');
  }
  // Shaded right faces.
  p.paint(inRect(9, 6, 2, 23), 'e').paint(inRect(28, 6, 2, 23), 'e');
  // Windows and gate.
  p.rect(5, 11, 2, 4, '0').rect(25, 11, 2, 4, '0');
  p.rect(13, 20, 6, 9, '0').disc(16, 20, 3, '0');
  p.paint(inRect(14, 17, 1, 12), 'f', '0').paint(inRect(17, 17, 1, 12), 'f', '0').paint(inRect(13, 23, 6, 1), 'f', '0');
  // Banner.
  p.rect(16, 0, 1, 9, 'j').rect(17, 0, 6, 3, '2').rect(17, 3, 4, 1, '2').set(17, 0, '3');
  p.outline();
  shadowUnder(p, 30, 14);
  return p.grid();
}

function shadow(): string[] {
  const p = new PixelCanvas(22, 6);
  p.ellipse(11, 3, 10, 2.6, SHADOW);
  return p.grid();
}

// ---------------------------------------------------------------- UI (8x8, drawn at 2x)

const ICONS: Record<string, string[]> = {
  icon_coin: ['..3333..', '.344c43.', '3444c443', '3444c443', '3444c443', '34444443', '.344443.', '..3333..'],
  icon_heart: ['.22..22.', '2c222222', '22222222', '22222222', '.222222.', '..2222..', '...22...', '........'],
  pip: ['..4..', '.434.', '43c34', '.434.', '..4..'],
  px: ['c'],
};

export const GRASS_VARIANTS = 4;
export const PATH_VARIANTS = 3;

/** Every texture the game uses, keyed by texture name. */
export function buildSprites(): Record<string, SpriteSource> {
  const one = (grid: string[]): SpriteSource => ({ grid, scale: 1 });
  const out: Record<string, SpriteSource> = {
    enemy_grunt_0: one(grunt(0)),
    enemy_grunt_1: one(grunt(1)),
    enemy_runner_0: one(runner(0)),
    enemy_runner_1: one(runner(1)),
    enemy_brute_0: one(brute(0)),
    enemy_brute_1: one(brute(1)),
    base_archer: one(baseArcher()),
    base_cannon: one(baseCannon()),
    base_frost: one(baseFrost()),
    head_archer: one(headArcher()),
    head_cannon: one(headCannon()),
    head_frost: one(headFrost()),
    proj_archer: one(projArcher()),
    proj_cannon: one(projCannon()),
    proj_frost: one(projFrost()),
    deco_tree: one(tree()),
    deco_rock: one(rock()),
    portal: one(portal()),
    castle: one(castle()),
    shadow: one(shadow()),
  };
  for (let i = 0; i < GRASS_VARIANTS; i++) out[`tile_grass_${i}`] = one(grassTile(101 + i * 17));
  for (let i = 0; i < PATH_VARIANTS; i++) out[`tile_path_${i}`] = one(pathTile(503 + i * 31));
  for (const [key, grid] of Object.entries(ICONS)) out[key] = { grid, scale: 2 };
  return out;
}
