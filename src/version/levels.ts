import { BUILTIN_LEVEL, randomLevel, type LevelDef } from '../config/level';
import type { MapMode } from '../config/settings';
import type { GameContent } from './compile';

/**
 * The level to play for some content: the default game follows the title screen's
 * map choice, a version uses its own random-map options or hand-drawn map.
 * `allowShortcut` is the player's own shortcut switch (default game only).
 */
export function levelForContent(content: GameContent, seed: number, mapMode: MapMode, allowShortcut = true): LevelDef {
  const plan = content.map;
  if (plan.kind === 'drawn') {
    const m = plan.map;
    return {
      name: content.name,
      cols: m.cols,
      rows: m.rows,
      path: m.path,
      extraPaths: m.extraPaths.length ? m.extraPaths : undefined,
      terrain: m.terrain,
      decorations: m.decorations,
      boatRoute: m.boatRoute ?? undefined,
      waves: content.waves,
    };
  }
  if (plan.kind === 'random') {
    const level = randomLevel(seed, plan.options, content.waves);
    if (!plan.shortcut) delete level.shortcut;
    return level;
  }
  if (mapMode === 'classic') return { ...BUILTIN_LEVEL, waves: content.waves };
  const level = randomLevel(seed, {}, content.waves);
  if (!allowShortcut) delete level.shortcut;
  return level;
}

/** Whether the level's map can be re-rolled with a new seed. */
export const isRandomPlan = (content: GameContent, mapMode: MapMode): boolean =>
  content.map.kind === 'random' || (content.map.kind === 'menu' && mapMode === 'random');
