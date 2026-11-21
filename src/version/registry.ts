import { compileVersion, defaultContent, hasFamilyGame, ORIGINAL_CONTENT, type GameContent } from './compile';
import type { VersionData } from './format';
import { activeVersionId, loadActiveVersion, ORIGINAL_ID, setActiveVersionId } from './store';

/**
 * The game content in play right now: the default game (a family copy's own game,
 * or else the original), the original game, or the family version
 * the current player picked. Scenes read it when they start.
 */
let active: GameContent = defaultContent();
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
    active = v ? compileVersion(v) : defaultContent();
    return true;
  } catch {
    active = defaultContent();
    temporary = false;
    return false;
  }
}

/** True while a tried-out version is in play instead of the player's saved choice. */
export const isTryingVersion = (): boolean => temporary;

/** Plays the original game, in a family copy that has its own game. */
export function useOriginalGame(): void {
  active = ORIGINAL_CONTENT;
  temporary = false;
}

/** Plays the current player's saved choice again (or the default game), forgetting a choice that no longer works. */
export function useSavedVersion(): void {
  if (activeVersionId() === ORIGINAL_ID) {
    // Only a copy with its own game offers the original separately; elsewhere it is the default game.
    if (hasFamilyGame()) useOriginalGame();
    else setActiveVersion(null);
    return;
  }
  if (!setActiveVersion(loadActiveVersion()?.data ?? null)) setActiveVersionId(null);
}
