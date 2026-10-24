// Tests for family versions: the checker, maps, links and players.
// Run with `npm test` (Node's own test runner; no browser needed).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, test } from 'node:test';

// A stand-in for the browser's localStorage, shared by the players tests.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

const { checkVersion, parseVersionText, extractJson } = await import('../src/version/validate.ts');
const { compileVersion, difficultyFor } = await import('../src/version/compile.ts');
const { EXAMPLE_VERSIONS } = await import('../src/version/examples.ts');
const { decodeVersionHash, encodeVersionHash } = await import('../src/version/link.ts');
const { cleanText } = await import('../src/version/text.ts');
const { parseDrawnMap } = await import('../src/version/drawnMap.ts');
const { generateMap } = await import('../src/systems/MapGenerator.ts');
const { expandCorners } = await import('../src/config/map.ts');
const players = await import('../src/profile/players.ts');
const versionStore = await import('../src/version/store.ts');
const { levelForContent } = await import('../src/version/levels.ts');

const ok = (raw: unknown) => {
  const r = checkVersion(raw);
  assert.equal(r.ok, true, r.ok ? '' : r.error);
  return r as Extract<typeof r, { ok: true }>;
};

/** Every string anywhere inside a value. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe('garbage in', () => {
  for (const raw of [null, undefined, 42, 'hello', true, [], [1, 2], () => 1]) {
    test(`rejects ${typeof raw} ${JSON.stringify(raw) ?? ''}`, () => {
      assert.equal(checkVersion(raw).ok, false);
    });
  }

  test('pasted text with no JSON, broken JSON, or far too much', () => {
    assert.equal(parseVersionText('').ok, false);
    assert.equal(parseVersionText('Sure! Here is your version but I forgot it').ok, false);
    assert.equal(parseVersionText('```json\n{"name": "X", "enemies": [ {"id": "a",\n```').ok, false);
    assert.equal(parseVersionText('{' + ' '.repeat(300_000) + '}').ok, false);
  });

  test('finds the JSON inside a chatty Claude reply', () => {
    const reply = 'Here you go!\n\n```json\n{"name": "Frog Land"}\n```\nHave fun!';
    assert.equal(extractJson(reply), '{"name": "Frog Land"}');
    const r = parseVersionText(reply);
    assert.ok(r.ok && r.version.name === 'FROG LAND');
  });

  test('an empty object is a plain renamed classic game', () => {
    const r = ok({});
    assert.equal(r.version.name, 'MY VERSION');
    assert.equal(compileVersion(r.version).towerOrder.length, 5);
  });

  test('wrong types are dropped, not trusted', () => {
    const r = ok({ name: 7, enemies: 'lots', towers: { a: 1 }, waves: 3, map: 'big', rules: [1] });
    assert.equal(r.version.name, 'MY VERSION');
    assert.equal(r.version.enemies, undefined);
    assert.equal(r.version.towers, undefined);
    assert.ok(r.problems.length >= 5);
  });
});

describe('huge values are clamped and lists capped', () => {
  test('numbers', () => {
    const r = ok({
      rules: { gold: 1e12, lives: -5, speed: 'fast' },
      enemies: [{ id: 'big', hp: 1e9, speed: -3, reward: 1e6, lives: 999, size: 50 }],
      towers: [{ id: 't', cost: 1e9, levels: [{ damage: 1e9, range: 1000, rate: 1e5, splash: 99 }] }],
      traps: [{ kind: 'bomb', damage: 1e9, max: 1e3, radius: 100 }],
    });
    const e = r.version.enemies![0];
    assert.deepEqual([e.hp, e.speed, e.reward, e.lives, e.size], [5000, 0.2, 500, 20, 2]);
    assert.deepEqual(r.version.rules, { gold: 5000, lives: 1 });
    const l = r.version.towers![0].levels![0];
    assert.deepEqual([l.damage, l.range, l.rate, l.splash], [2000, 8, 10, 3]);
    assert.equal(r.version.towers![0].cost, 1000);
    assert.deepEqual([r.version.traps![0].damage, r.version.traps![0].max, r.version.traps![0].radius], [2000, 20, 3]);
    assert.ok(r.problems.some((p) => /too big/.test(p)));
  });

  test('NaN and Infinity never get through', () => {
    const r = ok(JSON.parse('{"enemies":[{"id":"x","hp":1e999,"speed":-1e999}]}'));
    assert.equal(r.version.enemies![0].hp, undefined);
    assert.equal(r.version.enemies![0].speed, undefined);
  });

  test('counts', () => {
    const many = (n: number, f: (i: number) => unknown) => Array.from({ length: n }, (_, i) => f(i));
    const r = ok({
      enemies: many(500, (i) => ({ id: `e${i}`, abilities: many(50, () => ({ type: 'summon', into: 'grunt' })) })),
      towers: many(40, (i) => ({ id: `t${i}` })),
      traps: many(40, (i) => ({ kind: 'tar', id: `trap${i}` })),
      waves: many(1000, () => ({ groups: many(100, () => ({ enemy: 'grunt', count: 1e6 })) })),
    });
    assert.equal(r.version.enemies!.length, 12);
    assert.equal(r.version.enemies![0].abilities!.length, 6);
    assert.equal(r.version.towers!.length, 6);
    assert.equal((r.version.traps ?? []).length, 2); // 6 towers + 2 traps fill the 8 shop slots
    assert.equal(r.version.waves!.length, 30);
    for (const w of r.version.waves!) {
      assert.ok(w.groups.length <= 8);
      assert.ok(w.groups.reduce((n, g) => n + g.count, 0) <= 200);
    }
  });

  test('text is cut to length', () => {
    const r = ok({ name: 'A'.repeat(5000), about: 'b '.repeat(5000), enemies: [{ id: 'x', name: 'N'.repeat(99), tip: 't'.repeat(999) }] });
    assert.equal(r.version.name.length, 24);
    assert.ok(r.version.about!.length <= 160);
    assert.equal(r.version.enemies![0].name!.length, 16);
    assert.equal(r.version.enemies![0].tip!.length, 80);
  });
});

describe('unknown fields are left out and reported', () => {
  test('at every level', () => {
    const r = ok({
      name: 'X',
      evil: 1,
      enemies: [{ id: 'a', laserEyes: true, abilities: [{ type: 'flying', wings: 4 }, { type: 'mind_control' }] }],
      towers: [{ id: 't', onFire: 'run()', levels: [{ damage: 5, range: 2, rate: 1, colour: 'red' }] }],
      map: { size: 'medium', volcano: true },
    });
    const json = JSON.stringify(r.version);
    for (const bad of ['evil', 'laserEyes', 'wings', 'mind_control', 'onFire', 'colour', 'volcano']) {
      assert.ok(!json.includes(bad), `${bad} should be gone`);
      assert.ok(r.problems.some((p) => p.includes(bad.replace('_', ' ')) || p.includes(bad)), `${bad} should be reported`);
    }
    assert.deepEqual(r.version.enemies![0].abilities, [{ type: 'flying' }]);
  });

  test('__proto__ and constructor keys pollute nothing', () => {
    const raw = JSON.parse('{"__proto__": {"polluted": 1}, "constructor": {"prototype": {"polluted": 2}}, "enemies": [{"id": "a", "__proto__": {"hp": 9}}], "colors": {"__proto__": "#ffffff"}}');
    const r = ok(raw);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.equal(Object.getPrototypeOf(r.version), Object.prototype);
    assert.equal(r.version.enemies![0].hp, undefined);
    assert.equal(r.version.colors, undefined);
  });

  test('waves naming missing enemies, and abilities naming missing enemies', () => {
    const r = ok({
      enemies: [{ id: 'a', abilities: [{ type: 'split', into: 'nobody' }] }],
      waves: [{ groups: [{ enemy: 'ghost_of_nothing', count: 3 }] }, { groups: [{ enemy: 'a', count: 2 }] }],
    });
    assert.equal(r.version.enemies![0].abilities, undefined);
    assert.equal(r.version.waves!.length, 1);
  });
});

describe('script-like text is shown harmlessly', () => {
  const nasty = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(document.cookie)',
    '"><svg onload=fetch("//evil.example")>',
    '${process.exit()}',
    '`rm -rf /`',
    'eval(atob("YWxlcnQoMSk="))',
    'visit http://evil.com or www.bad.net now',
    'mail me@spam.org',
    '‮\u0000﻿hidden',
  ];
  test('no markup, quotes, braces, slashes or addresses survive', () => {
    const r = ok({
      name: nasty[0],
      author: nasty[1],
      about: nasty.join(' '),
      enemies: nasty.map((n, i) => ({ id: `e${i}`, name: n, tip: n })),
      towers: [{ id: 't', name: nasty[3], about: nasty[2] }],
    });
    for (const s of strings(r.version)) {
      assert.ok(!/[<>"`{}$=\/\\;@\u0000-\u001f‮﻿]/.test(s), `unsafe characters left in: ${s}`);
      assert.ok(!/evil\.com|bad\.net|spam\.org|www|http/i.test(s), `address left in: ${s}`);
    }
  });

  test('ids are tame', () => {
    const r = ok({ enemies: [{ id: '../../etc/passwd' }, { id: 'Fire Dragon' }, { id: '<b>' }] });
    assert.deepEqual(r.version.enemies!.map((e) => e.id), ['fire_dragon']);
  });

  test('colours must be plain #rrggbb', () => {
    const r = ok({ theme: { accent: 'url(javascript:alert(1))', panel: '#12aB34' }, enemies: [{ id: 'a', color: 'red; background: url(x)' }] });
    assert.deepEqual(r.version.theme, { panel: '#12ab34' });
    assert.equal(r.version.enemies![0].color, undefined);
  });

  test('rude words are masked', () => {
    assert.equal(cleanText('you are a shit tower', 40), 'you are a **** tower');
    assert.equal(cleanText('Scunthorpe dragons', 40), 'Scunthorpe dragons');
  });
});

describe('drawings', () => {
  test('bad colours become empty squares, ragged rows are padded', () => {
    const r = ok({ colors: { Q: '#123456' }, enemies: [{ id: 'a', sprite: { frames: [['QQQQ', 'Q??Q', 'QQ', 'QQQQ']] } }] });
    assert.deepEqual(r.version.enemies![0].sprite!.frames[0], ['QQQQ', 'Q..Q', 'QQ..', 'QQQQ']);
  });

  test('oversized or empty drawings fall back to a built-in look', () => {
    const big = Array.from({ length: 40 }, () => 'c'.repeat(40));
    const r = ok({ enemies: [{ id: 'a', base: 'knight', sprite: { frames: [big] } }, { id: 'b', sprite: { frames: [['....', '....', '....', '....']] } }] });
    assert.equal(r.version.enemies![0].sprite, undefined);
    const c = compileVersion(r.version);
    assert.equal(c.enemies.a.texture, 'enemy_knight');
    assert.equal(c.enemies.b.texture, 'enemy_grunt');
  });
});

describe('drawn maps', () => {
  const base = [
    'P#########..',
    '.........#..',
    '..~~~~~~~=~~',
    '.........#..',
    '..TT.....#..',
    '.........#..',
    '..^^.....#..',
    '.........#..',
    '.........#..',
    '.........C..',
  ];
  test('a road over a bridge joins portal and castle', () => {
    const r = parseDrawnMap(base);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.map.cols, 12);
    assert.deepEqual(r.map.path[0], [0, 0]);
    assert.deepEqual(r.map.path[r.map.path.length - 1], [9, 9]);
  });

  test('a road broken by water (no bridge) is refused, and the version falls back to a random map', () => {
    const broken = base.map((row) => row.replace('=', '~'));
    assert.equal(parseDrawnMap(broken).ok, false);
    const r = ok({ map: { rows: broken } });
    assert.ok(r.problems.some((p) => /not joined/.test(p)));
    assert.ok(!('rows' in r.version.map!));
  });

  test('size limits and castle count', () => {
    assert.equal(parseDrawnMap(['P#C']).ok, false);
    assert.equal(parseDrawnMap(Array.from({ length: 30 }, () => '.'.repeat(40))).ok, false);
    assert.equal(parseDrawnMap(base.map((r) => r.replace('C', '#'))).ok, false);
  });

  test('boats need a water route to a dock', () => {
    const withRiver = base.map((r, i) => (i === 2 ? 'R.~~~~~~~=~D' : r));
    const r1 = parseDrawnMap(withRiver);
    assert.ok(r1.ok && r1.map.boatRoute === null);
    const joined = base.map((r, i) => (i === 2 ? 'R~~~~~~~~=~D' : r));
    const r2 = parseDrawnMap(joined);
    assert.ok(r2.ok && r2.map.boatRoute !== null);
  });
});

describe('the example versions', () => {
  for (const [key, raw] of Object.entries(EXAMPLE_VERSIONS)) {
    test(`${key} passes with nothing thrown away`, () => {
      const r = ok(raw);
      assert.deepEqual(r.problems, []);
      compileVersion(r.version);
    });
  }

  test('Ghost Manor: a stealthy ghost with its own drawing that splits on death, and a lantern that reveals', () => {
    const c = compileVersion(ok(EXAMPLE_VERSIONS.ghost_manor).version);
    const ghost = c.enemies.ghost;
    assert.equal(ghost.stealth, true);
    assert.deepEqual(ghost.abilities, [{ when: { kind: 'death' }, action: { type: 'spawn', enemy: 'wisp', count: 2 } }]);
    assert.match(ghost.texture, /^v\w+_e_ghost$/);
    assert.ok(c.sprites[`${ghost.texture}_0`] && c.sprites[`${ghost.texture}_1`]);
    assert.equal(c.sprites[`${ghost.texture}_0`].palette.G, '#e8f0ff');
    assert.equal(c.towers.lantern.reveal, 96);
    assert.deepEqual(c.towerOrder, ['archer', 'lantern', 'cannon', 'lightning', 'ballista']);
  });

  test('River Raid: a drawn river map with bridges, and boats that sail it', () => {
    const c = compileVersion(ok(EXAMPLE_VERSIONS.river_raid).version);
    assert.equal(c.map.kind, 'drawn');
    if (c.map.kind !== 'drawn') return;
    assert.ok(c.map.map.boatRoute);
    assert.equal(c.map.map.cols, 26);
    assert.equal(c.enemies.raider.boat, true);
    const level = levelForContent(c, 1, 'random');
    const bridges = level.terrain!.filter((t) => t.kind === 'water');
    assert.ok(bridges.length > 30);
  });

  test('Giant Kingdom: a large random map with a river, traps, and tower-smashing trolls', () => {
    const c = compileVersion(ok(EXAMPLE_VERSIONS.giant_kingdom).version);
    assert.deepEqual(c.trapOrder, ['bomb', 'tar', 'spikes']);
    assert.equal(c.traps.tar.kind, 'tar');
    assert.ok(c.enemies.troll.attack);
    const level = levelForContent(c, 77, 'random');
    assert.equal(level.cols, 32);
    assert.equal(level.rows, 22);
    assert.ok(level.boatRoute && level.terrain!.length > 20);
    assert.equal(difficultyFor('normal', c.rules).startMoney, 220);
  });
});

describe('random maps', () => {
  const classic = JSON.parse(readFileSync(new URL('./fixtures/classic-maps.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  test('classic-size maps are exactly what each map number always gave', () => {
    for (const [seed, before] of Object.entries(classic)) {
      const m = generateMap(Number(seed));
      assert.deepEqual({ corners: m.corners, decorations: m.decorations, shortcut: m.shortcut }, before, `map ${seed}`);
    }
  });

  test('rivers cross the road only on straight bridges, in every size', () => {
    for (const size of [{ cols: 20, rows: 15 }, { cols: 26, rows: 18 }, { cols: 32, rows: 22 }]) {
      let withRiver = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const m = generateMap(seed, { ...size, river: true, bridges: 2 });
        for (const [c, r] of expandCorners(m.corners)) assert.ok(c < size.cols && r < size.rows);
        if (!m.boatRoute) continue;
        withRiver++;
        const road = new Set(expandCorners(m.corners).map(([c, r]) => `${c},${r}`));
        const bridges = m.terrain.filter((t) => road.has(`${t.col},${t.row}`));
        assert.ok(bridges.length >= 1, `seed ${seed} needs a bridge`);
        const sc = new Set([...m.shortcut.tiles, m.shortcut.from, m.shortcut.to].map(([c, r]) => `${c},${r}`));
        assert.ok(!m.terrain.some((t) => sc.has(`${t.col},${t.row}`)), 'river must avoid the shortcut');
      }
      assert.ok(withRiver >= 36, `most ${size.cols}x${size.rows} maps should get a river (${withRiver}/40)`);
    }
  });
});

describe('share links', () => {
  test('round trip', async () => {
    for (const raw of Object.values(EXAMPLE_VERSIONS)) {
      const v = ok(raw).version;
      const hash = await encodeVersionHash(v);
      assert.match(hash, /^#v=1\.[A-Za-z0-9_-]+$/);
      const back = await decodeVersionHash(hash);
      assert.ok(back.ok);
      if (back.ok) assert.deepEqual(back.version, v);
    }
  });

  test('broken, hostile and oversized links are refused', async () => {
    assert.equal((await decodeVersionHash('#v=1.!!!!')).ok, false);
    assert.equal((await decodeVersionHash('#v=1.AAAA')).ok, false);
    assert.equal((await decodeVersionHash('#v=9.abc')).ok, false);
    assert.equal((await decodeVersionHash('#v=1.' + 'A'.repeat(200_000))).ok, false);
    // A "zip bomb": tiny link, megabytes when opened.
    const bomb = new Uint8Array(await new Response(new Blob([' '.repeat(5_000_000)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    let bin = '';
    bomb.forEach((b) => (bin += String.fromCharCode(b)));
    const hash = '#v=1.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assert.ok(hash.length < 20_000);
    const r = await decodeVersionHash(hash);
    assert.equal(r.ok, false);
  });

  test('a link with nasty data inside is cleaned like a paste', async () => {
    const json = JSON.stringify({ name: '<script>x</script>', enemies: [{ id: 'a', hp: 1e9, evil: true }] });
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    const r = await decodeVersionHash('#v=0.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.version.name, 'SCRIPT X SCRIPT');
    assert.equal(r.version.enemies![0].hp, 5000);
  });
});

describe('players', () => {
  beforeEach(() => store.clear());

  test('old saves move into the first player', () => {
    store.set('pixel-td-levels', '[{"id":"x"}]');
    store.set('pixel-td-difficulty', 'hard');
    const p = players.initPlayers();
    assert.equal(p.name, 'PLAYER 1');
    assert.equal(players.playerGet('levels'), '[{"id":"x"}]');
    assert.equal(players.playerGet('difficulty'), 'hard');
  });

  test('two players keep separate saves and versions', () => {
    players.initPlayers();
    const sam = players.addPlayer('sam <b>')!;
    assert.equal(sam.name, 'SAM B');
    players.playerSet('difficulty', 'easy');
    assert.equal(versionStore.saveVersion(ok(EXAMPLE_VERSIONS.ghost_manor).version).ok, true);
    players.switchPlayer(sam.id);
    assert.equal(players.playerGet('difficulty'), null);
    assert.equal(versionStore.listVersions().length, 0);
    players.playerSet('difficulty', 'hard');
    versionStore.saveVersion(ok(EXAMPLE_VERSIONS.river_raid).version);
    players.switchPlayer('p1');
    assert.equal(players.playerGet('difficulty'), 'easy');
    assert.deepEqual(versionStore.listVersions().map((v) => v.data.name), ['GHOST MANOR']);
    players.removePlayer(sam.id);
    assert.equal(players.listPlayers().length, 1);
    assert.ok(![...store.keys()].some((k) => k.startsWith(`pixel-td:${sam.id}:`)));
  });

  test('saved versions are checked again when loaded', () => {
    players.initPlayers();
    players.playerSet('versions', JSON.stringify([{ data: { name: '<x>', enemies: [{ id: 'a', hp: 1e9 }] } }, { data: 'junk' }]));
    const list = versionStore.listVersions();
    assert.equal(list.length, 1);
    assert.equal(list[0].data.enemies![0].hp, 5000);
  });
});
