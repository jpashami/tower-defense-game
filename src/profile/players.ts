/**
 * Players on one device. Each player has their own versions, Creator levels and
 * settings: their keys in localStorage are prefixed with "pixel-td:<player id>:".
 * The first time this runs, saves from before players existed move into PLAYER 1.
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

/** Used when the browser blocks storage, so the game still runs (nothing is kept). */
const memory = new Map<string, string>();

function rawGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function rawSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    memory.set(key, value);
    return false;
  }
}

function rawRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    memory.delete(key);
  }
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
  const prefix = `pixel-td:${id}:`;
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
