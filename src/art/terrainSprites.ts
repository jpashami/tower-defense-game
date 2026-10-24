import { PixelCanvas, SHADOW, inDisc, inEllipse, inRect, minus, rng } from './draw';

/**
 * Art for family versions: water, bridges, road surfaces, road traps, extra shot
 * looks and a few extra enemy looks (a raider boat, a slime and a bat).
 * Same conventions as sprites.ts: 32x32 unless noted, enemies have frames 0 and 1,
 * projectiles face right.
 */

type Frame = 0 | 1;

function shadowUnder(p: PixelCanvas, cy = 29.5, rx = 13): void {
  p.under(inEllipse(16, cy, rx, 2.5), SHADOW);
}

// ---------------------------------------------------------------- Ground

export function waterTile(seed: number): string[] {
  const rand = rng(seed);
  const p = new PixelCanvas(32, 32);
  p.rect(0, 0, 32, 32, '9');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (rand() < 0.05) p.set(x, y, '8');
  // Ripples.
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(rand() * 24);
    const y = 3 + Math.floor(rand() * 26);
    p.rect(x, y, 4, 1, 'a').set(x + 4, y + 1, 'a');
  }
  if (rand() < 0.5) p.set(3 + Math.floor(rand() * 26), 3 + Math.floor(rand() * 26), 'c');
  return p.grid();
}

/** Planks across a river. `along` is the way the road runs: 'h' (left-right) or 'v'. */
export function bridgeTile(along: 'h' | 'v'): string[] {
  const p = new PixelCanvas(32, 32);
  p.rect(0, 0, 32, 32, '9');
  if (along === 'h') {
    p.rect(0, 3, 32, 26, 'h');
    for (let x = 0; x < 32; x += 4) p.rect(x, 3, 1, 26, 'g');
    p.rect(0, 2, 32, 2, 'j').rect(0, 28, 32, 2, 'j');
    for (const x of [2, 14, 26]) p.rect(x, 1, 3, 3, 'g');
  } else {
    p.rect(3, 0, 26, 32, 'h');
    for (let y = 0; y < 32; y += 4) p.rect(3, y, 26, 1, 'g');
    p.rect(2, 0, 2, 32, 'j').rect(28, 0, 2, 32, 'j');
    for (const y of [2, 14, 26]) p.rect(1, y, 3, 3, 'g');
  }
  return p.grid();
}

export function sandTile(seed: number): string[] {
  const rand = rng(seed);
  const p = new PixelCanvas(32, 32);
  p.rect(0, 0, 32, 32, '4');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const r = rand();
    if (r < 0.08) p.set(x, y, 'i');
    else if (r < 0.11) p.set(x, y, '3');
  }
  // Wind ripples.
  for (let i = 0; i < 3; i++) {
    const y = 4 + Math.floor(rand() * 24);
    const x = Math.floor(rand() * 18);
    p.rect(x, y, 8 + Math.floor(rand() * 6), 1, 'i');
  }
  return p.grid();
}

export function iceTile(seed: number): string[] {
  const rand = rng(seed);
  const p = new PixelCanvas(32, 32);
  p.rect(0, 0, 32, 32, 'b');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (rand() < 0.06) p.set(x, y, 'a');
  // Cracks and shine.
  const x0 = Math.floor(rand() * 20);
  p.line(x0, 4, x0 + 8, 14, 'a').line(x0 + 8, 14, x0 + 5, 24, 'a');
  p.line(20, 6, 27, 6, 'c').line(22, 8, 25, 8, 'c');
  return p.grid();
}

export function lavaTile(seed: number): string[] {
  const rand = rng(seed);
  const p = new PixelCanvas(32, 32);
  p.rect(0, 0, 32, 32, '2');
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rand() * 32);
    const y = Math.floor(rand() * 32);
    p.ellipse(x, y, 2 + rand() * 4, 1.5 + rand() * 2, '3');
  }
  for (let i = 0; i < 4; i++) p.disc(Math.floor(rand() * 32), Math.floor(rand() * 32), 1.2, '4');
  // Dark crust.
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (rand() < 0.05) p.set(x, y, '1');
  return p.grid();
}

export function flowers(): string[] {
  const p = new PixelCanvas(32, 32);
  const spots: [number, number, string][] = [[8, 9, 'c'], [21, 7, '4'], [14, 18, 'o'], [25, 22, 'c'], [6, 24, '3']];
  for (const [x, y, petal] of spots) {
    p.points([[x, y + 2], [x, y + 3]], 'm');
    p.points([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], petal).set(x, y, '4');
  }
  return p.grid();
}

/** A little wooden jetty where boats unload. */
export function dock(): string[] {
  const p = new PixelCanvas(32, 32);
  p.rect(4, 6, 24, 20, 'h');
  for (let y = 6; y < 26; y += 4) p.rect(4, y, 24, 1, 'g');
  for (const [x, y] of [[3, 4], [25, 4], [3, 23], [25, 23]] as [number, number][]) p.rect(x, y, 4, 5, 'j');
  p.disc(16, 16, 3, 'g').disc(16, 16, 1.5, 'j');
  return p.outline().grid();
}

// ---------------------------------------------------------------- Road traps

export function trapBomb(armed: boolean): string[] {
  const p = new PixelCanvas(32, 32);
  if (armed) {
    p.disc(16, 18, 8, 'f').paint(inDisc(13.5, 15.5, 3), 'e').set(12, 14, 'd');
    p.rect(15, 8, 3, 3, 'e');
    p.line(17, 8, 20, 4, 'h').points([[21, 3], [20, 2], [22, 3]], '3').set(21, 2, '4');
  } else {
    // Scorch mark left behind.
    p.ellipse(16, 18, 10, 6, 'f').ellipse(16, 18, 6, 3.5, '0');
    p.points([[7, 13], [25, 14], [10, 24], [23, 23]], 'e');
  }
  p.outline();
  shadowUnder(p, 27, 9);
  return p.grid();
}

export function trapSpikes(): string[] {
  const p = new PixelCanvas(32, 32);
  p.rect(3, 19, 26, 5, 'g').rect(3, 19, 26, 1, 'h');
  for (let x = 4; x <= 26; x += 4) {
    p.line(x, 18, x + 1, 9, 'd').line(x + 1, 9, x + 2, 18, 'e');
    p.set(x + 1, 9, 'c');
  }
  p.outline();
  shadowUnder(p, 26, 13);
  return p.grid();
}

export function trapTar(): string[] {
  const rand = rng(41);
  const p = new PixelCanvas(32, 32);
  p.ellipse(16, 17, 13, 10, '0').ellipse(9, 11, 5, 4, '0').ellipse(24, 23, 6, 4, '0');
  p.paint(inEllipse(13, 13, 4, 2), 'f');
  for (let i = 0; i < 5; i++) p.disc(6 + Math.floor(rand() * 20), 9 + Math.floor(rand() * 14), 1.2, '1');
  p.points([[11, 12], [12, 12], [20, 19]], 'e');
  return p.grid();
}

// ---------------------------------------------------------------- Shots

export function projMagic(): string[] {
  const p = new PixelCanvas(12, 12);
  p.diamond(6, 6, 4.5, 4.5, 'o').diamond(6, 6, 2.5, 2.5, 'c');
  return p.outline('1').grid();
}

export function projFire(): string[] {
  const p = new PixelCanvas(16, 10);
  p.ellipse(5, 5, 4, 2.5, '2').ellipse(9, 5, 4, 3.4, '3').disc(10.5, 5, 2.3, '4').set(11, 4, 'c');
  return p.outline().grid();
}

export function projPoison(): string[] {
  const p = new PixelCanvas(10, 10);
  p.disc(5, 5, 3.6, '6').points([[3, 3], [4, 3], [3, 4]], '5');
  return p.outline().grid();
}

export function projRock(): string[] {
  const p = new PixelCanvas(12, 12);
  p.ellipse(6, 6.5, 4.5, 3.8, 'e').paint(inEllipse(5, 5, 2, 1.4), 'd');
  p.paint(inRect(4, 8, 6, 2), 'f');
  return p.outline().grid();
}

// ---------------------------------------------------------------- Extra enemy looks

/** A raider rowing boat, seen from the side. */
export function boat(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  // Raider.
  p.rect(13, 9, 7, 8, '2').disc(16.5, 7, 4, '5').paint(minus(inDisc(16.5, 7, 4), inDisc(16, 6.5, 3.4)), '6');
  p.rect(14, 6, 2, 2, 'c').set(15, 7, '0').rect(18, 6, 2, 2, 'c').set(18, 7, '0');
  p.rect(13, 2, 7, 2, 'e').points([[12, 3], [21, 3]], 'd');
  // Oar sweeping between frames.
  if (frame === 0) p.line(20, 13, 27, 24, 'g');
  else p.line(20, 13, 23, 25, 'g');
  // Hull.
  p.fill((x, y) => y >= 16 && y <= 23 && x >= 3 + (y - 16) * 0.7 && x <= 28 - (y - 16) * 0.7, 'g');
  p.rect(3, 16, 26, 2, 'h').rect(5, 20, 22, 1, 'j');
  p.points([[2, 15], [29, 15]], 'h');
  // Bow wave.
  p.points([[1, 24], [2, 25], [29, 24], [30, 25]], 'c');
  return p.outline().grid();
}

export function slime(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  const squash = frame === 0 ? 0 : 2;
  const body = inEllipse(16, 20 + squash / 2, 11 + squash, 9 - squash);
  p.fill(body, '6');
  p.paint(minus(body, inEllipse(15, 19 + squash / 2, 10 + squash, 8 - squash)), '7');
  p.paint(inEllipse(11, 16 + squash, 3, 2), '5').set(10, 15 + squash, 'c');
  p.rect(11, 19 + squash, 3, 3, 'c').set(12, 20 + squash, '0');
  p.rect(18, 19 + squash, 3, 3, 'c').set(19, 20 + squash, '0');
  p.rect(14, 25, 4, 1, '0');
  p.outline();
  shadowUnder(p, 29.5, 11);
  return p.grid();
}

export function bat(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  if (frame === 0) p.ellipse(7, 12, 7, 4, '1').points([[1, 8], [3, 7], [5, 8]], '1');
  else p.ellipse(7, 19, 7, 3, '1').points([[1, 22], [3, 23], [5, 22]], '1');
  p.points([[12, 9], [12, 8], [11, 7]], '1');
  p.mirrorX();
  const body = inDisc(16, 15, 6);
  p.fill(body, 'f').paint(minus(body, inDisc(15, 14, 5.2)), '0');
  p.rect(13, 13, 2, 2, '2').rect(18, 13, 2, 2, '2');
  p.points([[14, 18], [18, 18]], 'c');
  return p.outline().grid();
}

/** 8x8 icons drawn at 2x. */
export const VERSION_ICONS: Record<string, string[]> = {
  icon_wrench: ['.....dd.', '....d..d', '....d.d.', '...ddd..', '..ddd...', '.ddd....', 'ddd.....', '.d......'],
  icon_eye: ['........', '..cccc..', '.cc00cc.', 'cc0bb0cc', '.cc00cc.', '..cccc..', '........', '........'],
};
