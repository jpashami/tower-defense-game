/**
 * Players on one device. Each player has their own versions, Creator levels and
 * settings: their keys in localStorage are prefixed with "pixel-td:<player id>:".
 * The first time this runs, saves from before players existed move into PLAYER 1.
 *
 * Family copies of the game hosted on the same github.io site share one localStorage,
 * so each copy keeps its saves apart under its repository name (see saveSpaceFor).
 */

export interface Player {
  id: string;
  name: string;
  /** Palette colour for their badge. */
  color: string;
}

export const MAX_PLAYERS = 6;
export const PLAYER_NAME_LENGTH = 12;
export const PLAYER_COLORS = ['#41a6f6', '#ef7d57', '#a7f070', '#c27bc2', '#ffcd75', '#73eff7'];

const PLAYERS_KEY = 'pixel-td-players';
const CURRENT_KEY = 'pixel-td-player';
/** Keys from before players existed, moved into the first player. */
const LEGACY_KEYS = ['pixel-td-levels', 'pixel-td-draft', 'pixel-td-difficulty', 'pixel-td-map', 'pixel-td-shortcut'];

/** The original game's repository. Its saves keep the plain keys they always had. */
const ORIGINAL_REPO = 'tower-defense-game';
/** Set in a copy's save space once the plain saves have been copied into it. */
const MIGRATED_KEY = 'pixel-td-migrated';

/**
 * The prefix for this copy's saves: "pixel-td@<repo>/" on <name>.github.io/<repo>/,
 * or "" for the original game, the dev server, the Android app and other hosts.
 */
export function saveSpaceFor(hostname: string, pathname: string): string {
  if (!hostname.toLowerCase().endsWith('.github.io')) return '';
  const repo = /^\/([A-Za-z0-9._-]{1,100})\//.exec(pathname)?.[1];
  if (!repo || repo.toLowerCase() === ORIGINAL_REPO) return '';
  return `pixel-td@${repo.toLowerCase()}/`;
}

let space = typeof location === 'undefined' ? '' : saveSpaceFor(location.hostname, location.pathname);

/** Used when the browser blocks storage, so the game still runs (nothing is kept). */
const memory = new Map<string, string>();

function rawGet(key: string): string | null {
  try {
    return localStorage.getItem(space + key);
  } catch {
    return memory.get(space + key) ?? null;
  }
}

function rawSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(space + key, value);
    return true;
  } catch {
    memory.set(space + key, value);
    return false;
  }
}

function rawRemove(key: string): void {
  try {
    localStorage.removeItem(space + key);
  } catch {
    memory.delete(space + key);
  }
}

/**
 * Switches to a copy's save space (tests use this too). The first time, saves made
 * before copies had their own space are copied in; the originals are left alone,
 * because another copy on the same site may still be using them.
 */
export function useSaveSpace(prefix: string): void {
  space = prefix;
  if (!space || rawGet(MIGRATED_KEY) !== null) return;
  try {
    if (rawGet(PLAYERS_KEY) === null) {
      const plain: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('pixel-td') && !k.startsWith('pixel-td@')) plain.push(k);
      }
      for (const k of plain) rawSet(k, localStorage.getItem(k) ?? '');
    }
  } catch {
    // Storage is blocked: nothing to copy.
  }
  rawSet(MIGRATED_KEY, '1');
}

/** Player names use the same safe letters as level names. */
export function cleanPlayerName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 !?-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, PLAYER_NAME_LENGTH);
}

export function listPlayers(): Player[] {
  try {
    const raw = JSON.parse(rawGet(PLAYERS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p): p is Player => !!p && typeof p.id === 'string' && /^p[a-z0-9]{1,12}$/.test(p.id) && typeof p.name === 'string')
      .slice(0, MAX_PLAYERS)
      .map((p) => ({
        id: p.id,
        name: cleanPlayerName(p.name) || 'PLAYER',
        color: PLAYER_COLORS.includes(p.color) ? p.color : PLAYER_COLORS[0],
      }));
  } catch {
    return [];
  }
}

function writePlayers(players: Player[]): void {
  rawSet(PLAYERS_KEY, JSON.stringify(players));
}

/** Makes sure there is at least one player, moving old saves into it the first time. */
export function initPlayers(): Player {
  useSaveSpace(space);
  let players = listPlayers();
  if (players.length === 0) {
    const first: Player = { id: 'p1', name: 'PLAYER 1', color: PLAYER_COLORS[0] };
    for (const key of LEGACY_KEYS) {
      const v = rawGet(key);
      if (v !== null) rawSet(`pixel-td:${first.id}:${key.replace('pixel-td-', '')}`, v);
    }
    players = [first];
    writePlayers(players);
    rawSet(CURRENT_KEY, first.id);
  }
  return currentPlayer();
}

export function currentPlayer(): Player {
  const players = listPlayers();
  const id = rawGet(CURRENT_KEY);
  return players.find((p) => p.id === id) ?? players[0] ?? { id: 'p1', name: 'PLAYER 1', color: PLAYER_COLORS[0] };
}

export function switchPlayer(id: string): void {
  if (listPlayers().some((p) => p.id === id)) rawSet(CURRENT_KEY, id);
}

export function addPlayer(name: string): Player | null {
  const players = listPlayers();
  if (players.length >= MAX_PLAYERS) return null;
  let n = players.length + 1;
  while (players.some((p) => p.id === `p${n}`)) n++;
  const used = new Set(players.map((p) => p.color));
  const player: Player = {
    id: `p${n}`,
    name: cleanPlayerName(name).trim() || `PLAYER ${n}`,
    color: PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[n % PLAYER_COLORS.length],
  };
  writePlayers([...players, player]);
  return player;
}

export function renamePlayer(id: string, name: string): void {
  const clean = cleanPlayerName(name).trim();
  if (!clean) return;
  writePlayers(listPlayers().map((p) => (p.id === id ? { ...p, name: clean } : p)));
}

/** Removes a player and everything they saved. The last player can't be removed. */
export function removePlayer(id: string): void {
  const players = listPlayers();
  if (players.length <= 1) return;
  const prefix = `${space}pixel-td:${id}:`;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch {
    for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
  }
  const rest = players.filter((p) => p.id !== id);
  writePlayers(rest);
  if (rawGet(CURRENT_KEY) === id) rawSet(CURRENT_KEY, rest[0].id);
}

/** The current player's saved value for a key, e.g. "levels". */
export function playerGet(key: string): string | null {
  return rawGet(`pixel-td:${currentPlayer().id}:${key}`);
}

/** Saves a value for the current player; false if the browser refused. */
export function playerSet(key: string, value: string): boolean {
  return rawSet(`pixel-td:${currentPlayer().id}:${key}`, value);
}

export function playerRemove(key: string): void {
  rawRemove(`pixel-td:${currentPlayer().id}:${key}`);
}
