import { cloneLevel, normaliseLevel, type CustomLevel } from './customLevel';

/** Saved Creator levels live in this browser's storage. */
const STORAGE_KEY = 'pixel-td-levels';
export const MAX_SAVED = 6;

export function listLevels(): CustomLevel[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.map(normaliseLevel).filter((l): l is CustomLevel => l !== null && !!l.id);
  } catch {
    // Storage blocked or corrupted: behave as if empty.
    return [];
  }
}

function write(levels: CustomLevel[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
    return true;
  } catch {
    return false;
  }
}

export type SaveResult = { ok: true; level: CustomLevel } | { ok: false; reason: 'full' | 'storage' };

/** Saves over the level's own slot, or into a new one. */
export function saveLevel(level: CustomLevel): SaveResult {
  const levels = listLevels();
  const copy = cloneLevel(level);
  const i = copy.id ? levels.findIndex((l) => l.id === copy.id) : -1;
  if (i >= 0) levels[i] = copy;
  else {
    if (levels.length >= MAX_SAVED) return { ok: false, reason: 'full' };
    copy.id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
    levels.push(copy);
  }
  return write(levels) ? { ok: true, level: copy } : { ok: false, reason: 'storage' };
}

export function deleteLevel(id: string): void {
  write(listLevels().filter((l) => l.id !== id));
}

/** The level open in the Creator, kept so work survives a page reload even when not saved. */
const DRAFT_KEY = 'pixel-td-draft';

export function loadDraft(): CustomLevel | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? normaliseLevel(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveDraft(level: CustomLevel): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(level));
  } catch {
    // Not critical.
  }
}

/** Whether the level matches what is stored in its save slot. */
export function isSaved(level: CustomLevel): boolean {
  if (!level.id) return false;
  const stored = listLevels().find((l) => l.id === level.id);
  return !!stored && JSON.stringify(stored) === JSON.stringify(normaliseLevel(level));
}
