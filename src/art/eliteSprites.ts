import { PixelCanvas, SHADOW, inDisc, inEllipse, inRect, minus, rng } from './draw';

/**
 * Art for the elite enemies, advanced towers, shortcut path and spells.
 * Same conventions as sprites.ts: 32x32 unless noted, enemies have frames 0 and 1,
 * tower heads and projectiles face right.
 */

type Frame = 0 | 1;

function shadowUnder(p: PixelCanvas, cy = 29.5, rx = 13): void {
  p.under(inEllipse(16, cy, rx, 2.5), SHADOW);
}

// ---------------------------------------------------------------- Enemies

export function knight(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  const lUp = frame === 1 ? 2 : 0;
  const rUp = frame === 0 ? 2 : 0;
  // Armoured legs.
  p.rect(12, 23 - lUp, 3, 5, 'e').rect(11, 27 - lUp, 4, 2, 'f');
  p.rect(17, 23 - rUp, 3, 5, 'e').rect(17, 27 - rUp, 4, 2, 'f');
  // Sword held upright in the right hand.
  p.rect(24, 5, 2, 15, 'c').rect(25, 5, 1, 15, 'd').set(24, 4, 'c');
  p.rect(22, 19, 6, 1, '4').rect(24, 20, 2, 3, 'g');
  p.rect(21, 15, 3, 6, 'e');
  // Breastplate and belt.
  p.rect(10, 14, 12, 10, 'd').rect(11, 15, 3, 4, 'c').rect(10, 21, 12, 2, 'f').rect(15, 21, 2, 2, '4');
  p.paint(inRect(19, 14, 3, 7), 'e', 'd');
  // Shield with a gold cross, held in front.
  p.ellipse(8, 18.5, 5, 6.5, '9');
  p.paint(inEllipse(7, 17, 3, 4), 'a');
  p.rect(7, 13, 2, 11, '4').rect(4, 17, 8, 2, '4');
  // Helmet with a visor and red plume.
  const head = inDisc(16, 9, 6.5);
  p.fill(head, 'd');
  p.paint(minus(head, inDisc(15, 8, 5.8)), 'e');
  p.paint(inDisc(13.5, 6, 1.5), 'c');
  p.rect(11, 9, 10, 2, '0').points([[13, 9], [18, 9]], 'b');
  p.rect(15, 0, 2, 4, '2').points([[14, 1], [17, 1], [14, 2]], '2').set(15, 0, '3');
  return p.outline().grid();
}

export function wolfRider(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  // Legs: front and back pairs alternate.
  const a = frame === 0 ? 0 : 2;
  const b = frame === 0 ? 2 : 0;
  p.rect(8, 24 - a, 2, 5, 'e').rect(11, 24 - b, 2, 5, 'e');
  p.rect(21, 24 - b, 2, 5, 'e').rect(24, 24 - a, 2, 5, 'e');
  // Tail.
  p.line(6, 20, 2, 16, 'e').line(5, 20, 1, 17, 'e').set(1, 15, 'd');
  // Body and head, facing right.
  const body = inEllipse(15.5, 21, 10, 5);
  p.fill(body, 'e');
  p.paint(inEllipse(15.5, 23.5, 7, 2), 'd');
  p.paint(minus(body, inEllipse(15, 20.4, 9.4, 4.4)), 'f');
  p.disc(25, 17, 4.5, 'e').rect(27, 17, 4, 3, 'd').set(30, 17, '0');
  p.points([[23, 12], [24, 12], [23, 13], [26, 12], [26, 13]], 'e');
  p.set(26, 16, '4').points([[28, 19], [29, 19]], 'c');
  // Saddle and goblin rider with a lance.
  p.rect(11, 15, 9, 2, '2');
  p.rect(13, 9, 5, 7, 'g').rect(13, 10, 2, 4, 'h');
  p.disc(15.5, 6.5, 3.5, '5').paint(inRect(12, 3, 8, 2), 'f').set(16, 6, '0');
  p.line(9, 13, 29, 6, 'h').points([[30, 5], [29, 5], [30, 6]], 'd');
  return p.outline().grid();
}

export function shaman(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  // Staff with a glowing orb.
  p.rect(6, 7, 2, 22, 'g').rect(6, 7, 1, 22, 'h');
  p.disc(7, 5, 3, 'b').disc(7, 5, 1.5, 'c');
  // Flowing robe; the hem sways between frames.
  const sway = frame === 0 ? 1 : -1;
  p.fill((x, y) => y >= 12 && y <= 28 && Math.abs(x + 0.5 - 16 - (y > 24 ? sway : 0)) <= 4 + (y - 12) * 0.3, '7');
  p.paint((x, y) => x < 16 && y > 13, '6', '7');
  p.paint(inRect(15, 13, 2, 15), 'b', '6');
  p.paint(inRect(15, 13, 2, 15), 'b', '7');
  // Hands on the staff and a bead necklace.
  p.disc(8.5, 17, 1.8, '5').disc(22.5, 19, 1.8, '5');
  p.points([[13, 13], [15, 14], [17, 14], [19, 13]], '4');
  // Hood with a shadowed face and glowing eyes.
  const hood = inDisc(16, 8.5, 6.5);
  p.fill(hood, '7');
  p.paint(inEllipse(16, 9.5, 4, 3.5), '0');
  p.points([[14, 9], [18, 9]], 'b');
  p.points([[16, 1], [15, 2], [17, 2]], '7');
  return p.outline().grid();
}

export function wyvern(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  // Wings: spread wide on frame 0, folded down on frame 1.
  if (frame === 0) {
    p.ellipse(14, 7.5, 7, 5, '7').ellipse(14, 24.5, 7, 5, '7');
    p.line(9, 4, 18, 13, '6').line(13, 2, 18, 13, '6').line(9, 28, 18, 19, '6').line(13, 30, 18, 19, '6');
  } else {
    p.ellipse(13, 11, 6, 3, '7').ellipse(13, 21, 6, 3, '7');
    p.line(8, 10, 18, 14, '6').line(8, 22, 18, 18, '6');
  }
  // Tail with a spade tip.
  p.line(8, 16, 3, 18, 'm').line(8, 17, 3, 19, 'm').points([[1, 18], [2, 17], [2, 19], [1, 20], [0, 19]], '2');
  // Body and head, facing right.
  const body = inEllipse(15, 16, 8, 4.5);
  p.fill(body, '6');
  p.paint(inEllipse(15, 17.5, 6, 1.5), '5');
  p.paint(minus(body, inEllipse(14.5, 15.5, 7.5, 4)), 'm');
  p.disc(24, 16, 3.6, '6').rect(26, 15, 4, 3, '6').set(29, 16, '0');
  p.points([[22, 13], [23, 12], [21, 12]], 'd');
  p.set(25, 15, '4').points([[27, 17], [28, 17]], 'c');
  return p.outline().grid();
}

export function warlord(frame: Frame): string[] {
  const p = new PixelCanvas(32, 32);
  const lUp = frame === 1 ? 2 : 0;
  const rUp = frame === 0 ? 2 : 0;
  // Cape behind.
  p.rect(7, 12, 18, 16, '1');
  // Legs.
  p.rect(9, 24 - lUp, 6, 5, 'j').rect(8, 28 - lUp, 7, 3, '0');
  p.rect(17, 24 - rUp, 6, 5, 'j').rect(17, 28 - rUp, 7, 3, '0');
  // Battle axe on the right.
  p.rect(27, 4, 2, 24, 'g');
  p.ellipse(29, 8, 3, 5, 'd').paint(inEllipse(29.5, 7, 1.5, 3), 'c');
  p.ellipse(25.5, 8, 2, 4, 'e');
  // Arms.
  p.disc(5.5, 17, 4, 'm').disc(5, 23, 3.5, 'm');
  p.disc(26, 17, 4, 'm').disc(27, 22, 3, 'm');
  // Red plate armour with gold trim.
  p.ellipse(16, 18, 10, 8, '2');
  p.rect(9, 13, 14, 10, '2').rect(9, 13, 14, 1, '4').rect(15, 13, 2, 10, '4');
  p.paint(inRect(18, 14, 5, 8), '1', '2');
  p.rect(8, 22, 16, 2, 'j').rect(14, 22, 4, 2, '4');
  p.disc(7, 13, 4, '2').disc(25, 13, 4, '2');
  p.paint(inDisc(6, 11.5, 1.6), '3').paint(inDisc(24, 11.5, 1.6), '3');
  // Head with a gold crown.
  const head = inDisc(16, 8, 7);
  p.fill(head, 'm');
  p.paint(minus(head, inDisc(15, 7, 6.3)), '7');
  p.paint(inDisc(13, 6, 1.5), '6');
  p.rect(10, 1, 12, 3, '4').points([[10, 0], [13, 0], [16, 0], [19, 0], [21, 0]], '4').set(16, 2, '2');
  p.line(11, 6, 14, 7, '0').line(20, 6, 17, 7, '0');
  p.rect(12, 8, 2, 1, '3').rect(18, 8, 2, 1, '3');
  p.rect(13, 11, 6, 1, '0').points([[13, 10], [18, 10]], 'c');
  return p.outline().grid();
}

// ---------------------------------------------------------------- Towers

export function baseLightning(): string[] {
  const p = new PixelCanvas(32, 32);
  p.disc(16, 17, 12, 'f');
  p.disc(16, 14, 12, 'e');
  p.paint((x, y) => inDisc(16, 14, 12)(x, y) && x + y < 26, 'd', 'e');
  // Copper rings.
  p.fill(minus(inDisc(16, 14, 9), inDisc(16, 14, 7.5)), 'h');
  p.paint((x, y) => minus(inDisc(16, 14, 9), inDisc(16, 14, 7.5))(x, y) && x + y > 32, 'g');
  p.disc(16, 14, 5, 'f');
  for (const [x, y] of [[6, 6], [26, 6], [6, 22], [26, 22]] as [number, number][]) p.disc(x, y, 1.6, '3');
  p.outline();
  shadowUnder(p);
  return p.grid();
}

export function headLightning(): string[] {
  const p = new PixelCanvas(32, 32);
  // Prongs.
  for (const [x, y] of [[7, 7], [24, 7], [7, 24], [24, 24]] as [number, number][]) {
    p.line(16, 16, x, y, 'e').set(x, y, 'd');
  }
  // Tesla coil seen from above: copper windings around a glowing core.
  p.disc(16, 16, 7, 'h');
  p.fill(minus(inDisc(16, 16, 5.5), inDisc(16, 16, 4.5)), 'g');
  p.paint((x, y) => inDisc(16, 16, 7)(x, y) && x + y < 28, '3', 'h');
  p.disc(16, 16, 3.5, 'a').disc(16, 16, 2.2, 'b').disc(16, 16, 1, 'c');
  return p.outline().grid();
}

export function baseBallista(): string[] {
  const p = new PixelCanvas(32, 32);
  p.rect(3, 4, 26, 21, 'g');
  for (const y of [9, 14, 19]) p.rect(3, y, 26, 1, 'j');
  p.rect(3, 25, 26, 3, 'j');
  // Iron corner plates and rivets.
  for (const [x, y] of [[2, 3], [24, 3], [2, 20], [24, 20]] as [number, number][]) {
    p.rect(x, y, 6, 6, 'e').rect(x + 1, y, 4, 1, 'd').set(x + 2, y + 2, 'f').set(x + 3, y + 3, 'f');
  }
  p.outline();
  shadowUnder(p);
  return p.grid();
}

export function headBallista(): string[] {
  const p = new PixelCanvas(32, 32);
  // Stock.
  p.rect(5, 14, 18, 4, 'g').rect(5, 14, 18, 1, 'h');
  // Steel limbs and string.
  p.line(18, 3, 22, 13, 'd').line(19, 3, 23, 13, 'e');
  p.line(18, 29, 22, 19, 'd').line(19, 29, 23, 19, 'e');
  p.line(18, 3, 8, 16, 'c').line(8, 16, 18, 29, 'c');
  // Loaded bolt.
  p.rect(8, 15, 19, 2, 'd').points([[27, 15], [27, 16], [28, 15], [28, 16], [29, 16], [29, 15]], 'c');
  p.points([[8, 14], [9, 14], [8, 17], [9, 17]], '2');
  // Winch.
  p.disc(9, 16, 3, 'e').set(9, 16, 'f');
  return p.outline().grid();
}

export function projBallista(): string[] {
  const p = new PixelCanvas(24, 5);
  p.line(3, 2, 19, 2, 'd');
  p.points([[20, 2], [19, 1], [19, 3], [21, 2], [22, 2]], 'c');
  p.points([[2, 1], [3, 1], [2, 3], [3, 3], [1, 2]], '2');
  return p.outline().grid();
}

// ---------------------------------------------------------------- Map pieces

/** A darker, rougher dirt for the shortcut so players can spot it. */
export function shortcutTile(seed: number): string[] {
  const rand = rng(seed);
  const p = new PixelCanvas(32, 32);
  p.rect(0, 0, 32, 32, 'h');
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const r = rand();
      if (r < 0.08) p.set(x, y, 'g');
      else if (r < 0.12) p.set(x, y, 'i');
    }
  }
  // Wheel ruts.
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(rand() * 27);
    const y = 2 + Math.floor(rand() * 27);
    p.points([[x, y], [x + 1, y]], 'e');
  }
  return p.grid();
}

/** A spiked wooden barricade that closes the shortcut until it opens. */
export function gate(): string[] {
  const p = new PixelCanvas(32, 32);
  // Posts.
  p.rect(3, 6, 4, 22, 'g').rect(25, 6, 4, 22, 'g').rect(4, 6, 1, 22, 'h').rect(26, 6, 1, 22, 'h');
  // Planks.
  p.rect(3, 10, 26, 5, 'h').rect(3, 19, 26, 5, 'h');
  p.rect(3, 14, 26, 1, 'g').rect(3, 23, 26, 1, 'g');
  // Cross brace.
  p.line(7, 10, 24, 23, 'j').line(7, 11, 24, 24, 'j');
  // Spikes.
  for (const x of [4, 9, 14, 19, 24, 27]) p.points([[x, 5], [x, 4], [x, 3]], 'd');
  p.outline();
  shadowUnder(p, 29.5, 13);
  return p.grid();
}

// ---------------------------------------------------------------- Spells

export function meteor(): string[] {
  const p = new PixelCanvas(20, 20);
  // Flaming trail up and to the left.
  p.line(1, 1, 11, 11, '2').line(2, 1, 12, 11, '3').line(1, 2, 11, 12, '3');
  p.disc(13, 13, 6, '2').disc(13, 13, 4.6, '3').disc(12.5, 12.5, 3, '4').disc(12, 12, 1.4, 'c');
  return p.outline().grid();
}

/** 8x8 icons drawn at 2x, like the coin and heart. */
export const ELITE_ICONS: Record<string, string[]> = {
  icon_lock: ['..eee...', '.e...e..', '.e...e..', 'dddddddd', 'dddffddd', 'ddddfddd', 'dddddddd', '........'],
  icon_meteor: ['2.......', '.23.....', '..2334..', '...3443.', '...4c43.', '...3443.', '....33..', '........'],
  icon_freeze: ['...b....', '.b.b.b..', '..bcb...', 'bbcccbb.', '..bcb...', '.b.b.b..', '...b....', '........'],
  icon_shortcut: ['........', '.4......', '.44.....', '.4444444', '.44.....', '.4......', '........', '........'],
};
