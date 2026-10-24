import { playerGet, playerRemove, playerSet } from '../profile/players';
import { versionHash } from './compile';
import type { VersionData } from './format';
import { checkVersion } from './validate';

/** Each player keeps up to this many versions. */
export const MAX_VERSIONS = 10;

export interface SavedVersion {
  id: string;
  data: VersionData;
}

const LIST_KEY = 'versions';
const ACTIVE_KEY = 'active-version';

/** The current player's saved versions. Each is checked again on the way in, like anything from outside. */
export function listVersions(): SavedVersion[] {
  try {
    const raw = JSON.parse(playerGet(LIST_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const out: SavedVersion[] = [];
    for (const item of raw.slice(0, MAX_VERSIONS)) {
      const checked = checkVersion((item as { data?: unknown })?.data);
      if (checked.ok) out.push({ id: versionHash(checked.version), data: checked.version });
    }
    return out;
  } catch {
    return [];
  }
}

export type SaveVersionResult = { ok: true; id: string } | { ok: false; reason: 'full' | 'storage' };

/** Another saved version with the same name but different contents, if there is one. */
export function sameNameVersion(data: VersionData): SavedVersion | null {
  const id = versionHash(data);
  return listVersions().find((v) => v.id !== id && v.data.name === data.name) ?? null;
}

/**
 * Saves a version, or says why it couldn't. An identical one is just kept; `replace`
 * names a different saved version (usually an older one with the same name) to overwrite.
 */
export function saveVersion(data: VersionData, replace?: string): SaveVersionResult {
  const list = listVersions();
  const id = versionHash(data);
  let same = list.findIndex((v) => v.id === id);
  if (same < 0 && replace) same = list.findIndex((v) => v.id === replace);
  if (same >= 0) list[same] = { id, data };
  else if (list.length >= MAX_VERSIONS) return { ok: false, reason: 'full' };
  else list.push({ id, data });
  const wasActive = activeVersionId();
  if (!playerSet(LIST_KEY, JSON.stringify(list))) return { ok: false, reason: 'storage' };
  if (same >= 0 && wasActive && !list.some((v) => v.id === wasActive)) setActiveVersionId(id);
  return { ok: true, id };
}

export function deleteVersion(id: string): void {
  playerSet(LIST_KEY, JSON.stringify(listVersions().filter((v) => v.id !== id)));
  if (activeVersionId() === id) setActiveVersionId(null);
}

/** Which saved version the current player plays; null for the classic game. */
export function activeVersionId(): string | null {
  return playerGet(ACTIVE_KEY) || null;
}

export function setActiveVersionId(id: string | null): void {
  if (id) playerSet(ACTIVE_KEY, id);
  else playerRemove(ACTIVE_KEY);
}

/** The current player's chosen version, if it still exists. */
export function loadActiveVersion(): SavedVersion | null {
  const id = activeVersionId();
  return id ? (listVersions().find((v) => v.id === id) ?? null) : null;
}
