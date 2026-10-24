// Creator share codes: old TD1 codes keep loading, and levels with water round-trip as TD2.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { decodeLevel, encodeLevel } = await import('../src/editor/shareCode.ts');
const { classicLevel, toLevelDef } = await import('../src/editor/customLevel.ts');
const { buildGrid } = await import('../src/config/map.ts');

test('an old TD1 code from the README still loads', () => {
  const level = decodeLevel('TD1.DRAGON_ROAD.46.L.2R9D8RA.E4R37R.600A01.0BD090QB0I03A0C.FD');
  assert.equal(typeof level, 'object');
  if (typeof level === 'string') return;
  assert.equal(level.name, 'DRAGON ROAD');
  assert.equal(level.water, undefined);
});

test('levels without water still make TD1 codes', () => {
  const code = encodeLevel(classicLevel());
  assert.match(code, /^TD1\./);
  const back = decodeLevel(code);
  assert.equal(typeof back, 'object');
  if (typeof back === 'string') return;
  assert.deepEqual([back.path, back.decorations, back.water], [classicLevel().path, classicLevel().decorations, undefined]);
});

test('levels with water make TD2 codes that round-trip, with bridges where the path crosses', () => {
  const level = classicLevel();
  level.water = [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]];
  const code = encodeLevel(level);
  assert.match(code, /^TD2\./);
  const back = decodeLevel(code);
  assert.equal(typeof back, 'object');
  if (typeof back === 'string') return;
  assert.deepEqual(back.water, level.water);
  const def = toLevelDef(back);
  const grid = buildGrid(def.path, def.decorations, { terrain: def.terrain });
  assert.equal(grid[2][3], 'bridge');
  assert.equal(grid[0][3], 'water');
});

test('tampered codes are refused', () => {
  const code = encodeLevel({ ...classicLevel(), water: [[5, 5]] });
  assert.equal(typeof decodeLevel(code.replace('TD2', 'TD1')), 'string');
  assert.equal(typeof decodeLevel(code.slice(0, -3) + 'ZZ'), 'string');
});
