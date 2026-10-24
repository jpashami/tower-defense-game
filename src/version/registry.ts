import { compileVersion, DEFAULT_CONTENT, type GameContent } from './compile';
import type { VersionData } from './format';

/**
 * The game content in play right now: the default game, or the family version
 * the current player picked. Scenes read it when they start.
 */
let active: GameContent = DEFAULT_CONTENT;

export function activeContent(): GameContent {
  return active;
}

/** Switches to a checked version, or back to the default game with null. */
export function setActiveVersion(v: VersionData | null): GameContent {
  active = v ? compileVersion(v) : DEFAULT_CONTENT;
  return active;
}
