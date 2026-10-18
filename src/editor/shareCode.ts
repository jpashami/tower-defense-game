import { TOWER_ORDER } from '../config/towers';
import { defaultTuning } from '../config/level';
import { ENEMY_ORDER, normaliseLevel, type CustomLevel, type WaveCounts } from './customLevel';

/**
 * Share codes squeeze a level into one line of letters and numbers, e.g.
 *   TD1.MY_LEVEL.46.K.2R5D5L3.......7X
 * Fields, separated by dots: version, name, gold, lives, path, decorations,
 * waves, towers, checksum. Numbers are base 36. The path is its start row
 * followed by direction + length pairs. Codes ignore upper/lower case.
 */
const VERSION = 'TD1';
const DIRS: Record<string, [number, number]> = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };

const b36 = (n: number, width = 1): string => n.toString(36).toUpperCase().padStart(width, '0');

function checksum(s: string): string {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1296;
  return b36(h, 2);
}

function encodePath(path: [number, number][]): string {
  if (path.length === 0) return '';
  let out = b36(path[0][1]);
  let i = 0;
  while (i < path.length - 1) {
    const dc = path[i + 1][0] - path[i][0];
    const dr = path[i + 1][1] - path[i][1];
    const dir = Object.keys(DIRS).find((k) => DIRS[k][0] === dc && DIRS[k][1] === dr)!;
    let run = 0;
    while (i < path.length - 1 && path[i + 1][0] - path[i][0] === dc && path[i + 1][1] - path[i][1] === dr) {
      run++;
      i++;
    }
    out += dir + b36(run);
  }
  return out;
}

export function encodeLevel(l: CustomLevel): string {
  const decor = l.decorations.map((d) => b36(d.col) + b36(d.row) + (d.kind === 'tree' ? 'T' : 'R')).join('');
  const waves = l.waves.map((w) => ENEMY_ORDER.map((e) => b36(w[e])).join('')).join('');
  const tuned = TOWER_ORDER.some((k) => {
    const d = defaultTuning(k);
    const t = l.towers[k];
    return t.damage !== d.damage || t.range !== d.range || t.cost !== d.cost;
  });
  const towers = tuned
    ? TOWER_ORDER.map((k) => {
        const t = l.towers[k];
        return b36(t.damage, 2) + b36(Math.round(t.range / 8)) + b36(Math.round(t.cost / 5), 2);
      }).join('')
    : '';
  const body = [
    VERSION,
    l.name.replace(/ /g, '_'),
    b36(l.startMoney),
    b36(l.startLives),
    encodePath(l.path),
    decor,
    waves,
    towers,
  ].join('.');
  return `${body}.${checksum(body)}`;
}

/** Splits a string into fixed-size chunks; null if it doesn't divide evenly. */
function chunks(s: string, size: number): string[] | null {
  if (s.length % size !== 0) return null;
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

const num = (s: string): number => (/^[0-9A-Z]+$/.test(s) ? parseInt(s, 36) : NaN);

/** Reads a share code. Returns the level, or a message saying what went wrong. */
export function decodeLevel(code: string): CustomLevel | string {
  const bad = "That code doesn't look right.\nCheck you copied all of it.";
  const clean = code.replace(/\s+/g, '').toUpperCase();
  const parts = clean.split('.');
  if (parts.length !== 9 || parts[0] !== VERSION) return bad;
  const body = parts.slice(0, 8).join('.');
  if (checksum(body) !== parts[8]) return bad;
  const [, name, money, lives, pathStr, decorStr, waveStr, towerStr] = parts;

  const path: [number, number][] = [];
  if (pathStr.length > 0) {
    const moves = chunks(pathStr.slice(1), 2);
    if (!moves) return bad;
    let c = 0;
    let r = num(pathStr[0]);
    path.push([c, r]);
    for (const [d, len] of moves) {
      const step = DIRS[d];
      const n = num(len);
      if (!step || !(n > 0)) return bad;
      for (let i = 0; i < n; i++) {
        c += step[0];
        r += step[1];
        path.push([c, r]);
      }
    }
  }

  const decor = chunks(decorStr, 3);
  const waves = chunks(waveStr, 3);
  const towers = towerStr ? chunks(towerStr, 5) : [];
  if (!decor || !waves || !towers || (towers.length !== 0 && towers.length !== TOWER_ORDER.length)) return bad;

  const raw = {
    name: name.replace(/_/g, ' '),
    startMoney: num(money),
    startLives: num(lives),
    path,
    decorations: decor.map((d) => ({ col: num(d[0]), row: num(d[1]), kind: d[2] === 'T' ? 'tree' : 'rock' })),
    waves: waves.map((w) => Object.fromEntries(ENEMY_ORDER.map((e, i) => [e, num(w[i])])) as WaveCounts),
    towers: Object.fromEntries(
      towers.map((t, i) => [
        TOWER_ORDER[i],
        { damage: num(t.slice(0, 2)), range: num(t[2]) * 8, cost: num(t.slice(3, 5)) * 5 },
      ]),
    ),
  };
  return normaliseLevel(raw) ?? bad;
}
