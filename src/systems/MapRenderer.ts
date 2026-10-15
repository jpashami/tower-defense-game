import Phaser from 'phaser';
import { COLS, DEPTH, ROWS, TILE } from '../config/constants';
import { DECORATIONS, PATH_TILES, type TileType } from '../config/map';
import { col } from '../art/palette';

export const GRASS_VARIANTS = 3;
export const PATH_VARIANTS = 2;

/** Draws ground tiles, path edges, decorations, the spawn portal and the castle. */
export function renderMap(scene: Phaser.Scene, grid: TileType[][]): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isPath = grid[r][c] === 'path';
      const variant = (c * 7 + r * 13) % (isPath ? PATH_VARIANTS : GRASS_VARIANTS);
      scene.add
        .image(c * TILE, r * TILE, `${isPath ? 'tile_path' : 'tile_grass'}_${variant}`)
        .setOrigin(0)
        .setDepth(DEPTH.ground);
    }
  }

  // Dark rim wherever path meets grass.
  const edge = scene.add.graphics().setDepth(DEPTH.pathEdge);
  edge.fillStyle(col('g'), 1);
  const isPath = (c: number, r: number) => c < 0 || c >= COLS || r < 0 || r >= ROWS || grid[r][c] === 'path';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== 'path') continue;
      const x = c * TILE;
      const y = r * TILE;
      if (!isPath(c, r - 1)) edge.fillRect(x, y, TILE, 2);
      if (!isPath(c, r + 1)) edge.fillRect(x, y + TILE - 2, TILE, 2);
      if (!isPath(c - 1, r)) edge.fillRect(x, y, 2, TILE);
      if (!isPath(c + 1, r)) edge.fillRect(x + TILE - 2, y, 2, TILE);
    }
  }

  for (const d of DECORATIONS) {
    if (grid[d.row]?.[d.col] !== 'blocked') continue;
    scene.add
      .image(d.col * TILE, d.row * TILE, d.kind === 'tree' ? 'deco_tree' : 'deco_rock')
      .setOrigin(0)
      .setDepth(DEPTH.deco);
  }

  const [startC, startR] = PATH_TILES[0];
  const [endC, endR] = PATH_TILES[PATH_TILES.length - 1];
  const portal = scene.add
    .image(Math.max(0, startC) * TILE + TILE / 2, startR * TILE + TILE / 2, 'portal')
    .setDepth(DEPTH.deco);
  scene.tweens.add({ targets: portal, angle: 360, duration: 4000, repeat: -1 });
  scene.add
    .image(endC * TILE + TILE / 2, endR * TILE + TILE / 2, 'castle')
    .setDepth(DEPTH.towerBase);
}
