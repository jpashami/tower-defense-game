import Phaser from 'phaser';
import { DEPTH, TILE } from '../config/constants';
import { DECORATIONS, PATH_TILES, isRoad, tileCenter, type Decoration, type TileType } from '../config/map';
import { EDGE_DROP, SQUASH, TILE_H, depthAt, groundTop, liftOf, project } from '../config/view';
import { col } from '../art/palette';
import { GRASS_VARIANTS, PATH_VARIANTS, SURFACE_VARIANTS } from '../art/sprites';

export interface RenderExtras {
  /** Routes from other portals; each gets its own portal. */
  extraPaths?: [number, number][][];
  /** Boats' route; a dock is drawn at its end. */
  boatRoute?: [number, number][];
}

/**
 * Draws the map in the angled view (see config/view.ts): ground squares squashed to the
 * slant, little cliff faces where grass steps down to road or road to water, the dark road
 * rims and light shores, then the decorations, portals, castle and any dock standing on
 * top. Returns everything it created so the level editor can redraw.
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
  const lift = (c: number, r: number): number => liftOf(at(c, r));
  const made: Phaser.GameObjects.GameObject[] = [];

  const roadish = (c: number, r: number) => c < 0 || c >= cols || r < 0 || r >= rows || isRoad(at(c, r));
  const wet = (c: number, r: number) => c < 0 || c >= cols || r < 0 || r >= rows || at(c, r) === 'water' || at(c, r) === 'bridge';

  for (let r = 0; r < rows; r++) {
    // Each row draws over the one behind it, so raised squares cover the ground behind them.
    const depth = DEPTH.ground + r * 0.001;
    const g = scene.add.graphics().setDepth(depth + 0.0005);
    made.push(g);
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      const h = lift(c, r);
      const x = c * TILE;
      const top = groundTop(r) - h;
      made.push(scene.add.image(x, top, groundTexture(grid, c, r)).setOrigin(0).setScale(1, SQUASH).setDepth(depth));

      // The step down to whatever is in front (or the map's front edge).
      const below = r + 1 < rows ? lift(c, r + 1) : -EDGE_DROP;
      if (below < h) drawFace(g, t, x, top + TILE_H, h - below);

      // Dark rim where road meets grass, light shore around water.
      const rim = (test: (c: number, r: number) => boolean, colour: number) => {
        g.fillStyle(colour, 1);
        if (!test(c, r - 1)) g.fillRect(x, top, TILE, 2);
        if (!test(c, r + 1)) g.fillRect(x, top + TILE_H - 2, TILE, 2);
        if (!test(c - 1, r)) g.fillRect(x, top, 2, TILE_H);
        if (!test(c + 1, r)) g.fillRect(x + TILE - 2, top, 2, TILE_H);
      };
      if (isRoad(t) && t !== 'bridge') rim(roadish, col('g'));
      else if (t === 'water') rim(wet, col('a'));
    }
  }

  for (const d of decorations) {
    const t = at(d.col, d.row);
    if (d.kind === 'flowers' ? t !== 'grass' : t !== 'blocked') continue;
    const h = liftOf(t);
    if (d.kind === 'flowers') {
      made.push(scene.add.image(d.col * TILE, groundTop(d.row) - h, 'deco_flowers').setOrigin(0).setScale(1, SQUASH).setDepth(DEPTH.flat));
      continue;
    }
    made.push(standing(scene, d.kind === 'tree' ? 'deco_tree' : 'deco_rock', d.col, d.row, h, 4));
  }

  if (extras.boatRoute && extras.boatRoute.length > 1) {
    const [dc, dr] = extras.boatRoute[extras.boatRoute.length - 1];
    const p = project(dc * TILE, dr * TILE, 0, lift(dc, dr));
    made.push(scene.add.image(p.x, p.y, 'dock').setOrigin(0).setScale(1, SQUASH).setDepth(DEPTH.flat));
  }

  if (path.length < 2) return made;
  for (const route of [path, ...(extras.extraPaths ?? [])]) {
    const [startC, startR] = route[0];
    const c = Math.max(0, startC);
    const centre = tileCenter(c, startR);
    const p = project(centre.x, centre.y, 0, lift(c, startR));
    // A flat disc spinning on the ground: the holder squashes it, the picture inside turns.
    const portal = scene.add.image(0, 0, 'portal');
    const holder = scene.add.container(p.x, p.y, [portal]).setScale(1, SQUASH).setDepth(DEPTH.flat + 0.1);
    scene.tweens.add({ targets: portal, angle: 360, duration: 4000, repeat: -1 });
    made.push(holder);
  }
  const [endC, endR] = path[path.length - 1];
  made.push(standing(scene, 'castle', endC, endR, lift(endC, endR), 2));
  return made;
}

/** Something upright on a square, drawn from its feet; `foot` is how many empty pixels its picture has under them. */
export function standing(scene: Phaser.Scene, key: string, c: number, r: number, lift: number, foot: number): Phaser.GameObjects.Image {
  const centre = tileCenter(c, r);
  const p = project(centre.x, centre.y, 0, lift);
  return scene.add.image(p.x, p.y + foot, key).setOrigin(0.5, 1).setDepth(depthAt(DEPTH.standing, centre.y));
}

/** The front face of a step in the ground, coloured like the earth under that kind of ground. */
function drawFace(g: Phaser.GameObjects.Graphics, t: TileType, x: number, y: number, height: number): void {
  const [lip, body, foot] = faceColours(t);
  g.fillStyle(body, 1).fillRect(x, y, TILE, height);
  if (height > 2) g.fillStyle(lip, 1).fillRect(x, y, TILE, 1);
  g.fillStyle(foot, 1).fillRect(x, y + height - 1, TILE, 1);
}

function faceColours(t: TileType): [number, number, number] {
  switch (t) {
    case 'grass':
    case 'blocked':
      return [col('m'), col('g'), col('j')];
    case 'sand':
      return [col('i'), col('h'), col('g')];
    case 'ice':
      return [col('b'), col('9'), col('8')];
    case 'water':
      return [col('a'), col('8'), col('0')];
    case 'lava':
      return [col('3'), col('f'), col('0')];
    default:
      return [col('h'), col('g'), col('j')];
  }
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
