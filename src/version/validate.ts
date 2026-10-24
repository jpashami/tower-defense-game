import { PALETTE } from '../art/palette';
import { compileVersion } from './compile';
import { parseDrawnMap } from './drawnMap';
import {
  BUILTIN_ENEMY_KEYS,
  BUILTIN_TOWER_KEYS,
  ENEMY_ABILITIES,
  ENEMY_LOOKS,
  FORMAT,
  FORMAT_VERSION,
  LIMIT,
  MAP_SIZES,
  SHOT_LOOKS,
  TARGETS,
  TOWER_ABILITIES,
  TRAP_KINDS,
  type Ability,
  type AbilitySpec,
  type Grid,
  type Range,
  type VEnemy,
  type VersionData,
  type VGroup,
  type VLevel,
  type VMap,
  type VTower,
  type VTrap,
  type VWave,
  type When,
} from './format';
import { cleanId, cleanText, parseColour } from './text';

/**
 * The strict checker for family versions. It never trusts its input: it builds a
 * brand-new object from the fields it knows, clamps every number, caps every list
 * and cleans every text. Anything it doesn't recognise is left out and listed in
 * `problems`, in plain words, so the summary screen can show what was thrown away.
 */

export type CheckResult =
  | { ok: true; version: VersionData; problems: string[] }
  | { ok: false; error: string; problems: string[] };

type Obj = Record<string, unknown>;

const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Pulls the version JSON out of a Claude reply: a ```json block, or the outermost {...}. */
export function extractJson(text: string): string | null {
  const fence = /```(?:json)?\s*\n?([\s\S]*?)```/i.exec(text);
  if (fence && fence[1].includes('{')) return fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

/** Reads pasted text (a Claude reply or bare JSON) into a checked version. */
export function parseVersionText(text: string): CheckResult {
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, error: 'There is nothing to read. Paste Claude\'s whole reply.', problems: [] };
  if (text.length > LIMIT.textBytes) return { ok: false, error: 'That is far too long to be a version.', problems: [] };
  const json = extractJson(text);
  if (!json) return { ok: false, error: 'No version found. Paste the part of Claude\'s reply in the code box.', problems: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The version is cut off or has a typo. Ask Claude to send the whole JSON again.', problems: [] };
  }
  return checkVersion(raw);
}

class Checker {
  readonly problems: string[] = [];

  say(where: string, msg: string): void {
    if (this.problems.length < 200) this.problems.push(where ? `${where}: ${msg}` : msg);
  }

  /** The object's own fields, after reporting and dropping unknown ones. */
  fields(raw: unknown, where: string, allowed: readonly string[]): Obj | null {
    if (!isObj(raw)) {
      this.say(where, 'should be a { } block, so it was left out.');
      return null;
    }
    const out: Obj = {};
    for (const k of Object.keys(raw)) {
      if (allowed.includes(k)) out[k] = raw[k];
      else this.say(where, `"${cleanText(k, 24) || '?'}" isn't something the game knows, so it was left out.`);
    }
    return out;
  }

  num(o: Obj, k: string, where: string, [min, max]: Range, int = false): number | undefined {
    if (!own(o, k)) return undefined;
    let v = o[k];
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) v = Number(v);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.say(where, `${k} should be a number, so it was left out.`);
      return undefined;
    }
    let x = int ? Math.round(v) : Math.round(v * 100) / 100;
    if (x < min || x > max) {
      const used = Math.min(max, Math.max(min, x));
      this.say(where, `${k} ${x} is too ${x < min ? 'small' : 'big'}, so ${used} was used.`);
      x = used;
    }
    return x;
  }

  bool(o: Obj, k: string, where: string): boolean | undefined {
    if (!own(o, k)) return undefined;
    if (typeof o[k] === 'boolean') return o[k] as boolean;
    this.say(where, `${k} should be true or false, so it was left out.`);
    return undefined;
  }

  text(o: Obj, k: string, where: string, max: number, upper = false): string | undefined {
    if (!own(o, k)) return undefined;
    if (typeof o[k] !== 'string') {
      this.say(where, `${k} should be text, so it was left out.`);
      return undefined;
    }
    const t = cleanText(o[k], max, upper);
    if (t === '' && (o[k] as string).trim() !== '') this.say(where, `${k} had no letters the game can show, so it was left out.`);
    return t || undefined;
  }

  colour(o: Obj, k: string, where: string): string | undefined {
    if (!own(o, k)) return undefined;
    const c = parseColour(o[k]);
    if (c === null) {
      this.say(where, `${k} should be a colour like "#ff8800", so it was left out.`);
      return undefined;
    }
    return `#${c.toString(16).padStart(6, '0')}`;
  }

  oneOf<T extends string>(o: Obj, k: string, where: string, options: readonly T[]): T | undefined {
    if (!own(o, k)) return undefined;
    const v = typeof o[k] === 'string' ? (o[k] as string).trim().toLowerCase() : '';
    if ((options as readonly string[]).includes(v)) return v as T;
    this.say(where, `${k} must be one of ${options.join(', ')}, so it was left out.`);
    return undefined;
  }

  list(o: Obj, k: string, where: string, max: number): unknown[] {
    if (!own(o, k)) return [];
    const v = o[k];
    if (!Array.isArray(v)) {
      this.say(where, `${k} should be a list [ ], so it was left out.`);
      return [];
    }
    if (v.length > max) this.say(where, `only the first ${max} ${k} are used (there were ${v.length}).`);
    return v.slice(0, max);
  }
}

/** Checks anything (usually parsed JSON) and returns a clean version, or why it can't be used. */
export function checkVersion(raw: unknown): CheckResult {
  const ck = new Checker();
  const top = ck.fields(raw, '', ['format', 'v', 'name', 'author', 'about', 'theme', 'rules', 'colors', 'enemies', 'towers', 'traps', 'waves', 'map']);
  if (!top) return { ok: false, error: 'That is not a version. A version is one { } block of JSON.', problems: ck.problems };
  if (own(top, 'format') && top.format !== FORMAT) ck.say('', `format should be "${FORMAT}".`);
  if (own(top, 'v') && top.v !== FORMAT_VERSION) {
    if (typeof top.v === 'number' && top.v > FORMAT_VERSION) ck.say('', 'This version was made for a newer game, so some parts may be missing.');
    else ck.say('', `v should be ${FORMAT_VERSION}.`);
  }

  const out: VersionData = {
    format: FORMAT,
    v: FORMAT_VERSION,
    name: ck.text(top, 'name', 'name', LIMIT.name, true) ?? 'MY VERSION',
  };
  const author = ck.text(top, 'author', 'author', LIMIT.author, true);
  if (author) out.author = author;
  const about = ck.text(top, 'about', 'about', LIMIT.about);
  if (about) out.about = about;

  if (own(top, 'theme')) {
    const t = ck.fields(top.theme, 'theme', ['accent', 'panel']);
    if (t) {
      const theme = { accent: ck.colour(t, 'accent', 'theme'), panel: ck.colour(t, 'panel', 'theme') };
      if (theme.accent || theme.panel) out.theme = prune(theme);
    }
  }

  if (own(top, 'rules')) {
    const r = ck.fields(top.rules, 'rules', Object.keys(LIMIT.rules));
    if (r) {
      const rules = Object.fromEntries(
        (Object.keys(LIMIT.rules) as (keyof typeof LIMIT.rules)[]).map((k) => [k, ck.num(r, k, 'rules', LIMIT.rules[k], true)]),
      );
      if (Object.values(rules).some((v) => v !== undefined)) out.rules = prune(rules);
    }
  }

  // Extra sprite colours, named by capital letters.
  const colors: Record<string, string> = {};
  if (own(top, 'colors')) {
    const c = isObj(top.colors) ? top.colors : null;
    if (!c) ck.say('colors', 'should be a { } block, so it was left out.');
    for (const k of Object.keys(c ?? {})) {
      if (!/^[A-Z]$/.test(k)) {
        ck.say('colors', `"${cleanText(k, 8)}" must be one capital letter A-Z, so it was left out.`);
        continue;
      }
      if (Object.keys(colors).length >= LIMIT.colors) {
        ck.say('colors', `only ${LIMIT.colors} extra colours are allowed.`);
        break;
      }
      const v = ck.colour(c!, k, 'colors');
      if (v) colors[k] = v;
    }
    if (Object.keys(colors).length) out.colors = colors;
  }
  const spriteChars = new Set([...Object.keys(PALETTE), ...Object.keys(colors), '.']);

  // Enemies first, so abilities and waves can refer to them.
  const enemyIds = new Set<string>(BUILTIN_ENEMY_KEYS);
  const enemies: VEnemy[] = [];
  for (const [i, e] of ck.list(top, 'enemies', 'enemies', LIMIT.enemies).entries()) {
    const ve = checkEnemy(ck, e, i, spriteChars);
    if (!ve) continue;
    if (enemies.some((x) => x.id === ve.id)) {
      ck.say(`enemy ${ve.id}`, 'another enemy already has this id, so it was left out.');
      continue;
    }
    enemies.push(ve);
    enemyIds.add(ve.id);
  }
  for (const e of enemies) {
    e.abilities = e.abilities?.filter((a) => {
      if (typeof a.into !== 'string') return true;
      if (enemyIds.has(a.into)) return true;
      ck.say(`enemy ${e.id}`, `${a.type} needs an enemy called "${a.into}", which doesn't exist, so it was left out.`);
      return false;
    });
    if (e.abilities?.length === 0) delete e.abilities;
  }
  if (enemies.length) out.enemies = enemies;

  const towers: VTower[] = [];
  for (const [i, t] of ck.list(top, 'towers', 'towers', LIMIT.towers).entries()) {
    const vt = checkTower(ck, t, i, spriteChars);
    if (!vt) continue;
    if (towers.some((x) => x.id === vt.id)) {
      ck.say(`tower ${vt.id}`, 'another tower already has this id, so it was left out.');
      continue;
    }
    towers.push(vt);
  }
  if (towers.length) out.towers = towers;

  const traps: VTrap[] = [];
  const trapRoom = Math.min(LIMIT.traps, LIMIT.shop - (towers.length || BUILTIN_TOWER_KEYS.length));
  const rawTraps = ck.list(top, 'traps', 'traps', LIMIT.traps);
  if (rawTraps.length > trapRoom) ck.say('traps', `the shop has room for ${LIMIT.shop} things, so only ${Math.max(0, trapRoom)} traps fit.`);
  for (const [i, t] of rawTraps.slice(0, Math.max(0, trapRoom)).entries()) {
    const vt = checkTrap(ck, t, i);
    if (!vt) continue;
    const shopTowers: readonly string[] = towers.length ? towers.map((x) => x.id) : BUILTIN_TOWER_KEYS;
    if (traps.some((x) => x.id === vt.id) || shopTowers.includes(vt.id)) {
      ck.say(`trap ${vt.id}`, 'something else already has this id, so it was left out.');
      continue;
    }
    traps.push(vt);
  }
  if (traps.length) out.traps = traps;

  const waves: VWave[] = [];
  for (const [i, w] of ck.list(top, 'waves', 'waves', LIMIT.waves).entries()) {
    const vw = checkWave(ck, w, i, enemyIds);
    if (vw) waves.push(vw);
  }
  if (waves.length) out.waves = waves;
  else if (enemies.length) ck.say('waves', 'there are no waves, so the classic waves are used and the new enemies won\'t appear. Ask Claude to add waves.');

  const hasBoats = enemies.some((e) => e.abilities?.some((a) => a.type === 'boat'));
  if (own(top, 'map')) {
    const map = checkMap(ck, top.map, hasBoats);
    if (map) out.map = map;
  } else if (hasBoats) {
    ck.say('map', 'boats need a river, so the map gets one.');
    out.map = { size: 'small', river: true };
  }

  // Last line of defence: a version the game can't build is refused here, before it can be saved or played.
  try {
    compileVersion(out);
  } catch {
    return { ok: false, error: 'This version has a mistake the game can\'t use. Ask Claude to check it and send it again.', problems: ck.problems };
  }
  return { ok: true, version: out, problems: ck.problems };
}

function checkEnemy(ck: Checker, raw: unknown, i: number, spriteChars: Set<string>): VEnemy | null {
  const label = `enemy ${i + 1}`;
  const o = ck.fields(raw, label, ['id', 'base', 'name', 'tip', 'hp', 'speed', 'reward', 'lives', 'size', 'color', 'look', 'sprite', 'abilities']);
  if (!o) return null;
  const id = cleanId(o.id) ?? cleanId(typeof o.name === 'string' ? o.name : '');
  if (!id) {
    ck.say(label, 'needs an id like "ghost" (small letters, numbers and _), so it was left out.');
    return null;
  }
  const where = `enemy ${id}`;
  const e: VEnemy = { id };
  e.base = ck.oneOf(o, 'base', where, BUILTIN_ENEMY_KEYS);
  e.name = ck.text(o, 'name', where, LIMIT.enemyName, true);
  e.tip = ck.text(o, 'tip', where, LIMIT.tip);
  e.hp = ck.num(o, 'hp', where, LIMIT.enemy.hp, true);
  e.speed = ck.num(o, 'speed', where, LIMIT.enemy.speed);
  e.reward = ck.num(o, 'reward', where, LIMIT.enemy.reward, true);
  e.lives = ck.num(o, 'lives', where, LIMIT.enemy.lives, true);
  e.size = ck.num(o, 'size', where, LIMIT.enemy.size);
  e.color = ck.colour(o, 'color', where);
  e.look = ck.oneOf(o, 'look', where, ENEMY_LOOKS);
  if (own(o, 'sprite')) {
    const sp = ck.fields(o.sprite, `${where} sprite`, ['frames']);
    const frames = sp ? ck.list(sp, 'frames', `${where} sprite`, 2) : [];
    const grids = frames.map((f, k) => checkGrid(ck, f, `${where} sprite frame ${k + 1}`, spriteChars)).filter((g): g is Grid => !!g);
    if (grids.length) e.sprite = { frames: grids };
    else if (sp) ck.say(where, 'the drawing could not be used, so a built-in look is used instead.');
  }
  const abilities = checkAbilities(ck, o, where, ENEMY_ABILITIES);
  if (abilities.length) e.abilities = abilities;
  return prune(e);
}

function checkTower(ck: Checker, raw: unknown, i: number, spriteChars: Set<string>): VTower | null {
  const label = `tower ${i + 1}`;
  const o = ck.fields(raw, label, [
    'id', 'base', 'name', 'about', 'cost', 'unlock', 'levels', 'upgrades', 'air', 'target', 'hp', 'shot', 'shot_color', 'color', 'look', 'sprite', 'abilities',
  ]);
  if (!o) return null;
  const id = cleanId(o.id) ?? cleanId(typeof o.name === 'string' ? o.name : '');
  if (!id) {
    ck.say(label, 'needs an id like "fire_tower", so it was left out.');
    return null;
  }
  const where = `tower ${id}`;
  const t: VTower = { id };
  t.base = ck.oneOf(o, 'base', where, BUILTIN_TOWER_KEYS);
  t.name = ck.text(o, 'name', where, LIMIT.towerName, true);
  t.about = ck.text(o, 'about', where, LIMIT.towerAbout);
  t.cost = ck.num(o, 'cost', where, LIMIT.tower.cost, true);
  t.unlock = ck.num(o, 'unlock', where, LIMIT.tower.unlock, true);
  const levels: VLevel[] = [];
  for (const [k, l] of ck.list(o, 'levels', where, 3).entries()) {
    const lw = `${where} level ${k + 1}`;
    const lo = ck.fields(l, lw, ['damage', 'range', 'rate', 'splash']);
    if (!lo) continue;
    const prev = levels[levels.length - 1];
    const level: VLevel = {
      damage: ck.num(lo, 'damage', lw, LIMIT.tower.damage, true) ?? prev?.damage ?? 10,
      range: ck.num(lo, 'range', lw, LIMIT.tower.range) ?? prev?.range ?? 3,
      rate: ck.num(lo, 'rate', lw, LIMIT.tower.rate) ?? prev?.rate ?? 1,
    };
    const splash = ck.num(lo, 'splash', lw, LIMIT.tower.splash);
    if (splash) level.splash = splash;
    levels.push(level);
  }
  if (levels.length) t.levels = levels;
  const upgrades = ck.list(o, 'upgrades', where, 2);
  if (upgrades.length) {
    const ups = upgrades.map((u, k) => ck.num({ cost: u }, 'cost', `${where} upgrade ${k + 1}`, LIMIT.tower.upgrade, true)).filter((u): u is number => u !== undefined);
    if (ups.length) t.upgrades = ups;
  }
  t.air = ck.bool(o, 'air', where);
  t.target = ck.oneOf(o, 'target', where, TARGETS);
  t.hp = ck.num(o, 'hp', where, LIMIT.tower.hp, true);
  t.shot = ck.oneOf(o, 'shot', where, SHOT_LOOKS);
  t.shot_color = ck.colour(o, 'shot_color', where);
  t.color = ck.colour(o, 'color', where);
  t.look = ck.oneOf(o, 'look', where, BUILTIN_TOWER_KEYS);
  if (own(o, 'sprite')) {
    const sp = ck.fields(o.sprite, `${where} sprite`, ['base', 'head']);
    if (sp) {
      const base = own(sp, 'base') ? checkGrid(ck, sp.base, `${where} sprite base`, spriteChars) : undefined;
      const head = own(sp, 'head') ? checkGrid(ck, sp.head, `${where} sprite head`, spriteChars) : undefined;
      if (base || head) t.sprite = prune({ base, head });
    }
  }
  const abilities = checkAbilities(ck, o, where, TOWER_ABILITIES);
  if (abilities.length) t.abilities = abilities;
  return prune(t);
}

function checkTrap(ck: Checker, raw: unknown, i: number): VTrap | null {
  const label = `trap ${i + 1}`;
  const o = ck.fields(raw, label, ['id', 'kind', 'name', 'about', 'cost', 'max', 'damage', 'radius', 'uses', 'slow', 'rearm', 'color']);
  if (!o) return null;
  const kind = ck.oneOf(o, 'kind', label, TRAP_KINDS);
  if (!kind) {
    ck.say(label, `needs a kind: ${TRAP_KINDS.join(', ')}. It was left out.`);
    return null;
  }
  const id = cleanId(o.id) ?? kind;
  const where = `trap ${id}`;
  const L = LIMIT.trap;
  return prune({
    id,
    kind,
    name: ck.text(o, 'name', where, LIMIT.towerName, true),
    about: ck.text(o, 'about', where, LIMIT.towerAbout),
    cost: ck.num(o, 'cost', where, L.cost, true),
    max: ck.num(o, 'max', where, L.max, true),
    damage: ck.num(o, 'damage', where, L.damage, true),
    radius: ck.num(o, 'radius', where, L.radius),
    uses: ck.num(o, 'uses', where, L.uses, true),
    slow: ck.num(o, 'slow', where, L.slow, true),
    rearm: ck.num(o, 'rearm', where, L.rearm, true),
    color: ck.colour(o, 'color', where),
  });
}

function checkWave(ck: Checker, raw: unknown, i: number, enemyIds: Set<string>): VWave | null {
  const where = `wave ${i + 1}`;
  let groupsRaw: unknown[];
  if (Array.isArray(raw)) groupsRaw = raw.slice(0, LIMIT.groups);
  else {
    const o = ck.fields(raw, where, ['groups']);
    if (!o) return null;
    groupsRaw = ck.list(o, 'groups', where, LIMIT.groups);
  }
  const groups: VGroup[] = [];
  for (const g of groupsRaw) {
    const o = ck.fields(g, where, ['enemy', 'count', 'gap', 'wait']);
    if (!o) continue;
    const enemy = cleanId(o.enemy);
    if (!enemy || !enemyIds.has(enemy)) {
      ck.say(where, `there is no enemy called "${cleanText(String(o.enemy ?? ''), 16)}", so that group was left out.`);
      continue;
    }
    const group: VGroup = { enemy, count: ck.num(o, 'count', where, LIMIT.group.count, true) ?? 5 };
    const gap = ck.num(o, 'gap', where, LIMIT.group.gap);
    const wait = ck.num(o, 'wait', where, LIMIT.group.wait);
    if (gap !== undefined) group.gap = gap;
    if (wait) group.wait = wait;
    groups.push(group);
  }
  // Keep a wave to a sensible crowd.
  let total = groups.reduce((n, g) => n + g.count, 0);
  if (total > 200) {
    ck.say(where, `${total} enemies is too many for one wave, so it was cut to 200.`);
    for (const g of groups) g.count = Math.max(1, Math.floor((g.count * 200) / total));
    total = 200;
  }
  if (groups.length === 0) {
    ck.say(where, 'had no enemies, so it was left out.');
    return null;
  }
  return { groups };
}

function checkMap(ck: Checker, raw: unknown, hasBoats: boolean): VMap | null {
  if (isObj(raw) && own(raw, 'rows')) {
    const o = ck.fields(raw, 'map', ['rows']);
    const result = parseDrawnMap(o?.rows);
    if (!result.ok) {
      ck.say('map', `${result.error} A random map is used instead.`);
      return { size: 'small', river: hasBoats || undefined };
    }
    for (const note of result.notes) ck.say('map', note);
    if (hasBoats && !result.map.boatRoute) ck.say('map', 'boats need a river start (R) joined by water to a dock (D), so they will walk instead.');
    // Store the cleaned drawing: padded rows, unknown letters turned to grass.
    const rows = (o!.rows as string[])
      .map((r) => r.replace(/\s+$/, ''))
      .filter((r, k, all) => r !== '' || all.slice(k).some((x) => x.trim() !== ''))
      .map((r) => r.padEnd(result.map.cols, '.').replace(/[^.#:IL~=T^*PCRD]/g, '.'));
    return { rows };
  }
  const o = ck.fields(raw, 'map', ['size', 'river', 'bridges', 'shortcut', 'trees']);
  if (!o) return null;
  const map: VMap = prune({
    size: ck.oneOf(o, 'size', 'map', Object.keys(MAP_SIZES) as (keyof typeof MAP_SIZES)[]),
    river: ck.bool(o, 'river', 'map'),
    bridges: ck.num(o, 'bridges', 'map', LIMIT.random.bridges, true),
    shortcut: ck.bool(o, 'shortcut', 'map'),
    trees: ck.num(o, 'trees', 'map', LIMIT.random.trees),
  });
  if (hasBoats && !('river' in map && map.river)) {
    ck.say('map', 'boats need a river, so the map gets one.');
    (map as { river?: boolean }).river = true;
  }
  return map;
}

/** Normalises an ability's name: "Speed Burst" -> "speed_burst", with a few friendly aliases. */
function abilityType(raw: unknown): string {
  const t = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  const alias: Record<string, string> = {
    armor: 'armour', fly: 'flying', flyer: 'flying', ship: 'boat', invisible: 'stealth', regeneration: 'regen',
    healer: 'heal_aura', spawn: 'split', summon_minions: 'summon', explode_on_death: 'explode', speed: 'speed_burst',
    freeze: 'stun', multishot: 'multi_shot', crit: 'critical', cloud: 'poison_cloud', fire: 'burn', reveal_stealth: 'reveal',
    damage_towers: 'attack', attack_towers: 'attack', shield_up: 'shield',
  };
  return alias[t] ?? t;
}

function checkAbilities(ck: Checker, o: Obj, where: string, catalogue: Record<string, AbilitySpec>): Ability[] {
  const out: Ability[] = [];
  for (const raw of ck.list(o, 'abilities', where, LIMIT.abilities)) {
    const type = abilityType(isObj(raw) ? raw.type : raw);
    const spec = catalogue[type];
    if (!spec) {
      ck.say(where, `"${cleanText(String(isObj(raw) ? raw.type : raw), 20)}" isn't an ability the game knows, so it was left out.`);
      continue;
    }
    const a: Ability = { type };
    const fields = isObj(raw) ? ck.fields(raw, `${where} ${type}`, ['type', 'when', ...Object.keys(spec.params)]) : {};
    if (!fields) continue;
    let ok = true;
    for (const [k, ps] of Object.entries(spec.params)) {
      if (ps.enemy) {
        const id = cleanId(fields[k]);
        if (!id) {
          ck.say(`${where} ${type}`, `needs "${k}": the id of an enemy. It was left out.`);
          ok = false;
        } else a[k] = id;
        continue;
      }
      a[k] = ck.num(fields, k, `${where} ${type}`, ps.range!, ps.int) ?? (ps.def as number);
    }
    if (!ok) continue;
    const triggered = spec.trigger !== 'none' || type === 'shield';
    if (own(fields, 'when')) {
      if (!triggered) ck.say(`${where} ${type}`, 'is always on, so "when" was ignored.');
      else {
        const w = checkWhen(fields.when);
        if (w) a.when = w;
        else ck.say(`${where} ${type}`, 'has a "when" the game doesn\'t understand, so the usual one is used.');
      }
    }
    if (spec.trigger !== 'none' && !a.when) a.when = spec.trigger;
    // Always-on abilities only count once.
    if (!triggered && out.some((x) => x.type === type)) {
      ck.say(where, `${type} is listed twice; only the first counts.`);
      continue;
    }
    out.push(a);
  }
  return out;
}

function checkWhen(raw: unknown): When | null {
  if (raw === 'spawn' || raw === 'hit' || raw === 'death') return raw;
  if (!isObj(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== 1) return null;
  const v = Number(raw[keys[0]]);
  if (!Number.isFinite(v)) return null;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  if (keys[0] === 'every') return { every: r2(Math.min(60, Math.max(1, v))) };
  if (keys[0] === 'below') return { below: Math.round(Math.min(95, Math.max(5, v))) };
  if (keys[0] === 'near') return { near: r2(Math.min(5, Math.max(0.5, v))) };
  return null;
}

/** A sprite drawing: rows of palette characters, 4 to 32 squares each way. Short rows are padded. */
function checkGrid(ck: Checker, raw: unknown, where: string, chars: Set<string>): Grid | undefined {
  const { min, max } = LIMIT.sprite;
  if (!Array.isArray(raw) || raw.some((r) => typeof r !== 'string')) {
    ck.say(where, 'should be a list of text rows, so it was left out.');
    return undefined;
  }
  const rows = (raw as string[]).map((r) => r.replace(/\s+$/, ''));
  const w = Math.max(0, ...rows.map((r) => r.length));
  if (rows.length < min || rows.length > max || w < min || w > max) {
    ck.say(where, `is ${w}x${rows.length}; drawings must be ${min} to ${max} squares each way, so it was left out.`);
    return undefined;
  }
  let unknown = 0;
  const grid = rows.map((r) =>
    Array.from(r.padEnd(w, '.'), (ch) => {
      if (ch === ' ') return '.';
      if (chars.has(ch)) return ch;
      unknown++;
      return '.';
    }).join(''),
  );
  if (unknown) ck.say(where, `${unknown} squares used colours that don't exist and were left empty.`);
  if (grid.every((r) => /^\.*$/.test(r))) {
    ck.say(where, 'is empty, so it was left out.');
    return undefined;
  }
  return grid;
}

/** Drops undefined fields so saved versions stay small. */
function prune<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}
