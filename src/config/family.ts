import type { EnemyDef } from './enemies';
import type { TowerDef } from './towers';
import type { WaveDef } from './waves';

/**
 * Your family's own game, built on top of the original.
 *
 * Put your new towers, enemies and waves here instead of changing `towers.ts`,
 * `enemies.ts` or `waves.ts`. Those files are the original game, and keeping
 * them as they are means the original stays playable: as soon as anything is
 * added here, MY VERSION on the title screen offers both ORIGINAL GAME and
 * your game (named below), and your game is the one played by default.
 *
 * - `towers`: new towers, by key. Their sprites are drawn in `src/art/sprites.ts`
 *   like any other tower. The shop shows at most 8 towers and traps.
 * - `towerOrder`: the shop order. Leave it `null` for the original towers
 *   followed by yours, or list the keys you want (you can leave towers out).
 * - `enemies`: new enemies, by key, with two walk frames in `src/art/sprites.ts`.
 * - `waves`: leave it `null` to play the original waves. To use your enemies,
 *   copy `WAVES` from `waves.ts` in here and change it.
 *
 * Shared links (MY VERSION) and Creator codes always use the original game,
 * so they play the same in everyone's copy.
 */
export interface FamilyGame {
  name: string;
  towers: Record<string, TowerDef>;
  towerOrder: string[] | null;
  enemies: Record<string, EnemyDef>;
  waves: WaveDef[] | null;
}

export const FAMILY_GAME: FamilyGame = {
  name: 'OUR GAME',
  towers: {},
  towerOrder: null,
  enemies: {},
  waves: null,
};
