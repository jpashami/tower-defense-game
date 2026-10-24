import { compileVersion, DEFAULT_CONTENT, type GameContent } from './compile';
import type { VersionData } from './format';
import { loadActiveVersion, setActiveVersionId } from './store';

/**
 * The game content in play right now: the default game, or the family version
 * the current player picked. Scenes read it when they start.
 */
let active: GameContent = DEFAULT_CONTENT;
/** Set while trying out a version that isn't the player's saved choice (an example or a link). */
let temporary = false;

export function activeContent(): GameContent {
  return active;
}

/**
 * Switches to a checked version, or back to the default game with null. Never throws:
 * a version the game can't build falls back to the default game and returns false.
 * `trying` marks a version being tried out rather than the player's saved choice.
 */
export function setActiveVersion(v: VersionData | null, trying = false): boolean {
  temporary = trying && v !== null;
  try {
    active = v ? compileVersion(v) : DEFAULT_CONTENT;
    return true;
  } catch {
    active = DEFAULT_CONTENT;
    temporary = false;
    return false;
  }
}

/** True while a tried-out version is in play instead of the player's saved choice. */
export const isTryingVersion = (): boolean => temporary;

/** Plays the current player's saved choice again (or the default game), forgetting a choice that no longer works. */
export function useSavedVersion(): void {
  if (!setActiveVersion(loadActiveVersion()?.data ?? null)) setActiveVersionId(null);
}
