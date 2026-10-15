/**
 * Pixel-art sprites as character grids (see palette.ts).
 * Most are 16x16 and get drawn at 2x to fill a 32px tile.
 * Tower heads and projectiles face right; the game rotates them.
 */
export const SPRITES: Record<string, string[]> = {
  // ---------- Enemies ----------
  enemy_grunt: [
    '................',
    '................',
    '.....666666.....',
    '....66666666....',
    '....6c0660c6....',
    '...5666666665...',
    '....66600666....',
    '.....666666.....',
    '....gggggggg....',
    '...6gghgghgg6...',
    '...6gggggggg6...',
    '....gg0000gg....',
    '....gggggggg....',
    '....ff....ff....',
    '....ff....ff....',
    '...000....000...',
  ],
  enemy_runner: [
    '................',
    '................',
    '................',
    '....2......2....',
    '....22....22....',
    '....22222222....',
    '...2242222422...',
    '...2222222222...',
    '....222cc222....',
    '.....222222.....',
    '....33222233....',
    '..33.222222.33..',
    '.....222222.....',
    '.....2....2.....',
    '....22....22....',
    '................',
  ],
  enemy_brute: [
    '....11111111....',
    '...1111111111...',
    '..1110c11c0111..',
    '..111111111111..',
    '..11d111111d11..',
    '...1111001111...',
    '.eeeeeeeeeeeeee.',
    '11eeffffffffee11',
    '11eeffeeeeffee11',
    '11eeffffffffee11',
    '11.eeeeeeeeee.11',
    '...eee0000eee...',
    '...eeeeeeeeee...',
    '...fff....fff...',
    '...fff....fff...',
    '..0000....0000..',
  ],

  // ---------- Tower bases ----------
  base_archer: [
    '................',
    '................',
    '..gggggggggggg..',
    '.ghhhhhhhhhhhhg.',
    '.ghgggggggggghg.',
    '.ghgggggggggghg.',
    '.ghhhhhhhhhhhhg.',
    '.ghgggggggggghg.',
    '.ghgggggggggghg.',
    '.ghhhhhhhhhhhhg.',
    '.ghgggggggggghg.',
    '.ghgggggggggghg.',
    '.ghhhhhhhhhhhhg.',
    '..gggggggggggg..',
    '................',
    '................',
  ],
  base_cannon: [
    '................',
    '................',
    '..ffffffffffff..',
    '.feeeeeeeeeeeef.',
    '.fedddedddedddf.',
    '.fdedddedddeddf.',
    '.fedddedddedddf.',
    '.fdedddedddeddf.',
    '.fedddedddedddf.',
    '.fdedddedddeddf.',
    '.fedddedddedddf.',
    '.fdedddedddeddf.',
    '.feeeeeeeeeeeef.',
    '..ffffffffffff..',
    '................',
    '................',
  ],
  base_frost: [
    '................',
    '................',
    '..888888888888..',
    '.89999999999998.',
    '.89aa9aa9aa9aa8.',
    '.89aa9aa9aa9aa8.',
    '.89999999999998.',
    '.89aa9aa9aa9aa8.',
    '.89aa9aa9aa9aa8.',
    '.89999999999998.',
    '.89aa9aa9aa9aa8.',
    '.89aa9aa9aa9aa8.',
    '.89999999999998.',
    '..888888888888..',
    '................',
    '................',
  ],

  // ---------- Tower heads ----------
  head_archer: [
    '................',
    '................',
    '................',
    '..........gg....',
    '...........gg...',
    '.....666...hg...',
    '....66466...g...',
    '....64446ddddddc',
    '....66466...g...',
    '.....666...hg...',
    '...........gg...',
    '..........gg....',
    '................',
    '................',
    '................',
    '................',
  ],
  head_cannon: [
    '................',
    '................',
    '................',
    '................',
    '.....ffff.......',
    '....feeeefffff..',
    '...feddeeeeeee0.',
    '...fedeeeeeeee0.',
    '...feeeeeeeeee0.',
    '....feeeefffff..',
    '.....ffff.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  head_frost: [
    '................',
    '................',
    '.......b........',
    '......bab.......',
    '......bab.......',
    '.....baaab......',
    '.....bacab......',
    '....baacaab.....',
    '....bacccab.....',
    '....baacaab.....',
    '.....bacab......',
    '.....baaab......',
    '......bab.......',
    '.......b........',
    '................',
    '................',
  ],

  // ---------- Projectiles ----------
  proj_archer: ['g......c', 'hddddddc', 'g......c'],
  proj_cannon: ['.0000.', '0ffdd0', '0fffd0', '0ffff0', '0ffff0', '.0000.'],
  proj_frost: ['..bb..', '.bccb.', 'bcaacb', 'bcaacb', '.bccb.', '..bb..'],

  // ---------- Map decorations ----------
  deco_tree: [
    '................',
    '.....666666.....',
    '...6656666666...',
    '..665566666666..',
    '..655666666666..',
    '.66556666666666.',
    '.66666666666667.',
    '.66666666666677.',
    '..666666666677..',
    '..766666666777..',
    '...7766667777...',
    '.....77ggg77....',
    '......gggg......',
    '......gggg......',
    '.....gggggg.....',
    '................',
  ],
  deco_rock: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......eeee......',
    '....eeddeee.....',
    '...eddcdeeee....',
    '...edddeeeeef...',
    '..eeddeeeeeeff..',
    '..eeeeeeeeefff..',
    '..feeeeeeeefff..',
    '...ffffffffff...',
    '................',
    '................',
    '................',
  ],
  portal: [
    '................',
    '.....111111.....',
    '...1100000011...',
    '..110001100011..',
    '..100110011001..',
    '.11010000001011.',
    '.10100111100101.',
    '.10101000010101.',
    '.10101000010101.',
    '.10100111100101.',
    '.11010000001011.',
    '..100110011001..',
    '..110001100011..',
    '...1100000011...',
    '.....111111.....',
    '................',
  ],
  castle: [
    '................',
    '.d.d.d....d.d.d.',
    '.ddddd....ddddd.',
    '.deded....deded.',
    '.dddddddddddddd.',
    '.ddeddddddddedd.',
    '.dddddd22dddddd.',
    '.dddddd23dddddd.',
    '.dddddd2ddddddd.',
    '.ddeddddddddedd.',
    '.dddddd00dddddd.',
    '.ddddd0000ddddd.',
    '.ddddd0000ddddd.',
    '.ddddd0000ddddd.',
    '.eeeee0000eeeee.',
    '................',
  ],

  // ---------- UI ----------
  icon_coin: [
    '..3333..',
    '.344c43.',
    '3444c443',
    '3444c443',
    '3444c443',
    '34444443',
    '.344443.',
    '..3333..',
  ],
  icon_heart: [
    '.22..22.',
    '2c222222',
    '22222222',
    '22222222',
    '.222222.',
    '..2222..',
    '...22...',
    '........',
  ],
  pip: ['..4..', '.434.', '43c34', '.434.', '..4..'],
  px: ['c'],
};

/** Tiny deterministic random generator so tiles look the same every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** A 16x16 grass tile with scattered light and dark specks. */
export function grassGrid(seed: number): string[] {
  const rand = rng(seed);
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const r = rand();
      row += r < 0.07 ? '5' : r < 0.12 ? '7' : '6';
    }
    rows.push(row);
  }
  return rows;
}

/** A 16x16 dirt path tile with pebbles. */
export function pathGrid(seed: number): string[] {
  const rand = rng(seed);
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const r = rand();
      row += r < 0.1 ? 'h' : r < 0.13 ? 'd' : 'i';
    }
    rows.push(row);
  }
  return rows;
}
