import Phaser from 'phaser';
import { COLS, DEPTH, ROWS, TILE } from '../config/constants';
import { DECORATIONS, PATH_TILES, type Decoration, type TileType } from '../config/map';
import { col } from '../art/palette';
import { GRASS_VARIANTS, PATH_VARIANTS } from '../art/sprites';

/**
 * Draws ground tiles, path edges, decorations, the spawn portal and the castle.
 * Returns everything it created so the level editor can redraw.
 */
export function renderMap(
  scene: Phaser.Scene,
  grid: TileType[][],
  path: [number, number][] = PATH_TILES,
  decorations: Decoration[] = DECORATIONS,
): Phaser.GameObjects.GameObject[] {
  const made: Phaser.GameObjects.GameObject[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const type = grid[r][c];
      const ground = type === 'path' ? 'tile_path' : type === 'shortcut' ? 'tile_shortcut' : 'tile_grass';
      const variant = (c * 7 + r * 13) % (type === 'path' || type === 'shortcut' ? PATH_VARIANTS : GRASS_VARIANTS);
      made.push(
        scene.add
          .image(c * TILE, r * TILE, `${ground}_${variant}`)
          .setOrigin(0)
          .setDepth(DEPTH.ground),
      );
    }
  }

  // Dark rim wherever path meets grass.
  const edge = scene.add.graphics().setDepth(DEPTH.pathEdge);
  made.push(edge);
  edge.fillStyle(col('g'), 1);
  const isPath = (c: number, r: number) =>
    c < 0 || c >= COLS || r < 0 || r >= ROWS || grid[r][c] === 'path' || grid[r][c] === 'shortcut';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isPath(c, r)) continue;
      const x = c * TILE;
      const y = r * TILE;
      if (!isPath(c, r - 1)) edge.fillRect(x, y, TILE, 2);
      if (!isPath(c, r + 1)) edge.fillRect(x, y + TILE - 2, TILE, 2);
      if (!isPath(c - 1, r)) edge.fillRect(x, y, 2, TILE);
      if (!isPath(c + 1, r)) edge.fillRect(x + TILE - 2, y, 2, TILE);
    }
  }

  for (const d of decorations) {
    if (grid[d.row]?.[d.col] !== 'blocked') continue;
    made.push(
      scene.add
        .image(d.col * TILE, d.row * TILE, d.kind === 'tree' ? 'deco_tree' : 'deco_rock')
        .setOrigin(0)
        .setDepth(DEPTH.deco),
    );
  }

  if (path.length < 2) return made;
  const [startC, startR] = path[0];
  const [endC, endR] = path[path.length - 1];
  const portal = scene.add
    .image(Math.max(0, startC) * TILE + TILE / 2, startR * TILE + TILE / 2, 'portal')
    .setDepth(DEPTH.deco);
  scene.tweens.add({ targets: portal, angle: 360, duration: 4000, repeat: -1 });
  const castle = scene.add
    .image(endC * TILE + TILE / 2, endR * TILE + TILE / 2, 'castle')
    .setDepth(DEPTH.towerBase);
  made.push(portal, castle);
  return made;
}
