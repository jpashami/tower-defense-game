import Phaser from 'phaser';
import { DEPTH, TILE } from '../config/constants';
import { DECORATIONS, PATH_TILES, isRoad, type Decoration, type TileType } from '../config/map';
import { col } from '../art/palette';
import { GRASS_VARIANTS, PATH_VARIANTS, SURFACE_VARIANTS } from '../art/sprites';

export interface RenderExtras {
  /** Routes from other portals; each gets its own portal. */
  extraPaths?: [number, number][][];
  /** Boats' route; a dock is drawn at its end. */
  boatRoute?: [number, number][];
}

/**
 * Draws ground tiles, road and river edges, decorations, the portals, the castle and
 * any dock. The map's size comes from the grid. Returns everything it created so the
 * level editor can redraw.
 */
export function renderMap(
  scene: Phaser.Scene,
  grid: TileType[][],
  path: [number, number][] = PATH_TILES,
  decorations: Decoration[] = DECORATIONS,
  extras: RenderExtras = {},
): Phaser.GameObjects.GameObject[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const at = (c: number, r: number): TileType | undefined => grid[r]?.[c];
  const made: Phaser.GameObjects.GameObject[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      made.push(scene.add.image(c * TILE, r * TILE, groundTexture(grid, c, r)).setOrigin(0).setDepth(DEPTH.ground));
    }
  }

  // Dark rim wherever road meets grass, and a light shore around water.
  const edge = scene.add.graphics().setDepth(DEPTH.pathEdge);
  made.push(edge);
  const roadish = (c: number, r: number) => c < 0 || c >= cols || r < 0 || r >= rows || isRoad(at(c, r));
  const wet = (c: number, r: number) => c < 0 || c >= cols || r < 0 || r >= rows || at(c, r) === 'water' || at(c, r) === 'bridge';
  const rim = (test: (c: number, r: number) => boolean, colour: number, onlyOn: (t: TileType) => boolean) => {
    edge.fillStyle(colour, 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!onlyOn(grid[r][c])) continue;
        const x = c * TILE;
        const y = r * TILE;
        if (!test(c, r - 1)) edge.fillRect(x, y, TILE, 2);
        if (!test(c, r + 1)) edge.fillRect(x, y + TILE - 2, TILE, 2);
        if (!test(c - 1, r)) edge.fillRect(x, y, 2, TILE);
        if (!test(c + 1, r)) edge.fillRect(x + TILE - 2, y, 2, TILE);
      }
    }
  };
  rim(roadish, col('g'), (t) => isRoad(t) && t !== 'bridge');
  rim(wet, col('a'), (t) => t === 'water');

  for (const d of decorations) {
    const t = at(d.col, d.row);
    if (d.kind === 'flowers' ? t !== 'grass' : t !== 'blocked') continue;
    const key = d.kind === 'tree' ? 'deco_tree' : d.kind === 'rock' ? 'deco_rock' : 'deco_flowers';
    made.push(scene.add.image(d.col * TILE, d.row * TILE, key).setOrigin(0).setDepth(DEPTH.deco));
  }

  if (extras.boatRoute && extras.boatRoute.length > 1) {
    const [dc, dr] = extras.boatRoute[extras.boatRoute.length - 1];
    made.push(scene.add.image(dc * TILE + TILE / 2, dr * TILE + TILE / 2, 'dock').setDepth(DEPTH.deco));
  }

  if (path.length < 2) return made;
  for (const route of [path, ...(extras.extraPaths ?? [])]) {
    const [startC, startR] = route[0];
    const portal = scene.add
      .image(Math.max(0, startC) * TILE + TILE / 2, startR * TILE + TILE / 2, 'portal')
      .setDepth(DEPTH.deco);
    scene.tweens.add({ targets: portal, angle: 360, duration: 4000, repeat: -1 });
    made.push(portal);
  }
  const [endC, endR] = path[path.length - 1];
  made.push(scene.add.image(endC * TILE + TILE / 2, endR * TILE + TILE / 2, 'castle').setDepth(DEPTH.towerBase));
  return made;
}

/** Texture for one ground square, picking a stable variant and the bridge's direction. */
function groundTexture(grid: TileType[][], c: number, r: number): string {
  const type = grid[r][c];
  const v = (n: number) => (c * 7 + r * 13) % n;
  switch (type) {
    case 'path': return `tile_path_${v(PATH_VARIANTS)}`;
    case 'shortcut': return `tile_shortcut_${v(PATH_VARIANTS)}`;
    case 'water': return `tile_water_${v(SURFACE_VARIANTS)}`;
    case 'sand': return `tile_sand_${v(SURFACE_VARIANTS)}`;
    case 'ice': return `tile_ice_${v(SURFACE_VARIANTS)}`;
    case 'lava': return `tile_lava_${v(SURFACE_VARIANTS)}`;
    case 'bridge': {
      // The road runs along whichever neighbours are road too.
      const side = isRoad(grid[r]?.[c - 1]) || isRoad(grid[r]?.[c + 1]) || c === 0;
      return side ? 'tile_bridge_h' : 'tile_bridge_v';
    }
    default: return `tile_grass_${v(GRASS_VARIANTS)}`;
  }
}
