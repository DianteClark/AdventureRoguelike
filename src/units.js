// Items (weapons / gear / consumables) and units (heroes, recruits, monsters).
import {
  WEAPONS, FAMILIES, TIER_POWER, TIERS, GEAR, GEAR_TIER_NAMES, WEAPON_TRAITS, GEAR_TRAITS, weaponBase, gearBase,
  weaponIcon, BACKGROUNDS, NAMES, QUIRKS, MONSTERS, BANDITS, CONSUMABLES,
} from './data.js';
import { rand } from './rng.js';

let uid = 1;
export const newId = () => `${Date.now().toString(36)}${(uid++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

// ------------------------------------------------------------------ Items
function rollTraits(pool, tier, ranged, rng) {
  // tier 1: none, 2: 0-1, 3: 1, 4: 1-2, 5: 2
  const n = tier <= 1 ? 0 : tier === 2 ? (rng.chance(0.5) ? 1 : 0) : tier === 3 ? 1 : tier === 4 ? rng.int(1, 2) : 2;
  const options = pool.filter((t) => !t.ranged || ranged);
  const picked = [];
  const pre = () => picked.some((p) => p.pre), suf = () => picked.some((p) => p.suf);
  for (const t of rng.shuffle(options.slice())) {
    if (picked.length >= n) break;
    if ((t.pre && pre()) || (t.suf && suf())) continue;
    picked.push(t);
  }
  return picked.map((t) => t.id);
}

export function makeWeapon(id, tier, rng = rand, traits = null) {
  const base = weaponBase(id);
  const fam = FAMILIES[base.family];
  const ranged = fam.range[1] > 1;
  return {
    uid: newId(), kind: 'weapon', id, tier,
    traits: traits || rollTraits(WEAPON_TRAITS, tier, ranged, rng),
    _base: base.name,
  };
}

export function makeGear(id, tier, rng = rand, traits = null) {
  return { uid: newId(), kind: 'gear', id, tier, traits: traits || rollTraits(GEAR_TRAITS, tier, false, rng) };
}

export function makeConsumable(id) { return { uid: newId(), kind: 'consumable', id }; }

export function randomWeapon(tier, rng = rand, family = null) {
  const pool = WEAPONS.filter((w) => !w.tool && (!family || w.family === family));
  return makeWeapon(rng.pick(pool).id, tier, rng);
}
export function randomGear(tier, rng = rand) { return makeGear(rng.pick(GEAR).id, tier, rng); }
export function randomLoot(tier, rng = rand) {
  const r = rng.next();
  if (r < 0.45) return randomWeapon(tier, rng);
  if (r < 0.85) return randomGear(tier, rng);
  return makeConsumable(rng.chance(0.75) ? 'potion' : 'medipack');
}

const traitDef = (it, id) => (it.kind === 'weapon' ? WEAPON_TRAITS : GEAR_TRAITS).find((t) => t.id === id);

export function itemName(it) {
  if (!it) return '—';
  if (it.kind === 'consumable') return CONSUMABLES[it.id].name;
  const traits = it.traits.map((t) => traitDef(it, t)).filter(Boolean);
  const pre = traits.find((t) => t.pre), suf = traits.find((t) => t.suf);
  const baseName = it.kind === 'weapon' ? weaponBase(it.id).name : gearBase(it.id).name;
  const tierName = it.kind === 'weapon' ? TIERS[it.tier].name : GEAR_TIER_NAMES[it.tier];
  return [pre && pre.pre, tierName, baseName, suf && suf.suf].filter(Boolean).join(' ');
}

export function itemIcon(it) {
  if (it.kind === 'weapon') return weaponIcon(it.id);
  if (it.kind === 'gear') return gearBase(it.id).icon;
  return CONSUMABLES[it.id].icon;
}

// Flattened stat effects of an item
export function itemEffects(it) {
  const e = {};
  const add = (k, v) => { e[k] = (e[k] || 0) + v; };
  if (!it || it.kind === 'consumable') return e;
  if (it.kind === 'weapon') {
    const base = weaponBase(it.id), fam = FAMILIES[base.family];
    add('power', TIER_POWER[it.tier] + fam.power + ((base.mods && base.mods.power) || 0));
    add('acc', fam.acc + ((base.mods && base.mods.acc) || 0));
    add('crit', fam.crit + ((base.mods && base.mods.crit) || 0));
  } else {
    const g = gearBase(it.id);
    for (const [k, v] of Object.entries(g.per)) add(k, v * it.tier);
    if (g.id === 'Boot' && it.tier >= 4) add('mov', 1);
  }
  for (const tid of it.traits) {
    const t = traitDef(it, tid);
    if (t) for (const [k, v] of Object.entries(t.eff)) add(k, v);
  }
  return e;
}

export function itemDescription(it) {
  if (it.kind === 'consumable') return CONSUMABLES[it.id].text;
  const lines = [];
  const e = itemEffects(it);
  if (it.kind === 'weapon') {
    const fam = FAMILIES[weaponBase(it.id).family];
    const r = fam.range[0] === fam.range[1] ? `${fam.range[0]}` : `${fam.range[0]}-${fam.range[1] + (e.reach || 0)}`;
    lines.push(`${fam.label} · Power ${e.power} · Range ${r}`);
    lines.push(fam.desc);
  } else {
    const parts = [];
    if (e.hp) parts.push(`+${e.hp} HP`);
    if (e.def) parts.push(`+${e.def} DEF`);
    if (e.dodge) parts.push(`+${e.dodge} dodge`);
    if (e.acc) parts.push(`+${e.acc} acc`);
    if (e.crit) parts.push(`+${e.crit}% crit`);
    if (e.mov) parts.push(`+${e.mov} move`);
    lines.push(parts.join(' · '));
  }
  for (const tid of it.traits) { const t = traitDef(it, tid); if (t) lines.push(`✦ ${t.text}`); }
  return lines.join('\n');
}

export function itemValue(it) {
  if (it.kind === 'consumable') return CONSUMABLES[it.id].price;
  const base = it.kind === 'weapon' ? 18 : 15;
  return Math.round(base * TIERS[it.tier].price * (1 + it.traits.length * 0.35));
}

// ------------------------------------------------------------------ Units
export function makeUnit({ name, sprite, kind = 'char', bg = null, monster = null, level = 1, weapon = null, gear = null, team = 'player', quirk = null }) {
  let base;
  if (monster) {
    const m = MONSTERS[monster];
    base = { hp: m.hp, atk: m.atk, def: m.def, mov: m.mov, acc: m.acc || 0, dodge: m.dodge || 0, crit: m.crit || 3 };
  } else base = { ...BACKGROUNDS[bg].stats };
  const u = {
    id: newId(), name, team, kind, sprite, bg, monster, level, xp: 0,
    base, weapon, gear, quirk, hp: 0, alive: true, kills: 0,
  };
  // level scaling
  for (let i = 1; i < level; i++) growth(u, monster ? 'monster' : 'auto');
  u.hp = maxHp(u);
  return u;
}

function growth(u, mode = 'auto') {
  const g = { hp: 3, atk: 1, def: 0, dodge: 0 };
  if (mode === 'monster') { g.hp = 4; g.def = Math.random() < 0.4 ? 1 : 0; }
  else {
    if (Math.random() < 0.45) g.def = 1;
    if (Math.random() < 0.3) g.hp += 2;
    if (Math.random() < 0.25) g.dodge = 2;
    if (u.bg === 'brawler') g.hp += 1;
    if (u.bg === 'shadow') g.dodge += 1;
  }
  u.base.hp += g.hp; u.base.atk += g.atk; u.base.def += g.def; u.base.dodge += g.dodge;
  return g;
}

export const XP_TO_LEVEL = (lvl) => 60 + lvl * 30;
export const MAX_LEVEL = 12;

export function gainXp(u, amount) {
  if (u.level >= MAX_LEVEL) return null;
  u.xp += amount;
  let gained = null;
  while (u.level < MAX_LEVEL && u.xp >= XP_TO_LEVEL(u.level)) {
    u.xp -= XP_TO_LEVEL(u.level);
    u.level++;
    const g = growth(u);
    u.hp = Math.min(maxHp(u), u.hp + g.hp + 3);
    gained = gained || { level: u.level, g: { hp: 0, atk: 0, def: 0, dodge: 0 } };
    gained.level = u.level;
    for (const k in g) gained.g[k] += g[k];
  }
  return gained;
}

// ---- derived stats
function bonuses(u) {
  const a = itemEffects(u.weapon), b = itemEffects(u.gear);
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
  return out;
}
export const maxHp = (u) => u.base.hp + (bonuses(u).hp || 0);
export function stats(u) {
  const b = bonuses(u);
  const m = u.monster ? MONSTERS[u.monster] : null;
  let range, family = null, magic = false, heals = false, twin = false, pierce = false, sunder = 0;
  if (m) { range = m.range.slice(); magic = !!m.magic; }
  else if (u.weapon) {
    family = weaponBase(u.weapon.id).family;
    const fam = FAMILIES[family];
    range = fam.range.slice(); magic = !!fam.magic; heals = !!fam.heals; twin = !!fam.twin; pierce = !!fam.pierce; sunder = fam.sunder || 0;
    if (b.reach && range[1] > 1) range[1] += b.reach;
  } else range = [1, 1];
  return {
    hpMax: u.base.hp + (b.hp || 0),
    atk: u.base.atk + (b.power || 0) + (m ? 2 + m.t : 0), // monsters' natural weapons
    def: u.base.def + (b.def || 0),
    mov: u.base.mov + (b.mov || 0),
    acc: (u.base.acc || 0) + (b.acc || 0),
    dodge: (u.base.dodge || 0) + (b.dodge || 0),
    crit: (u.base.crit || 0) + (b.crit || 0),
    lifesteal: b.lifesteal || 0, healOnKill: b.healOnKill || 0, execute: b.execute || 0,
    regen: b.regen || 0, thorns: b.thorns || 0, lastStand: b.lastStand || 0, gold: b.gold || 0,
    sunder: sunder + (b.sunder || 0),
    range, family, magic, heals, twin, pierce, fly: !!(m && m.fly),
  };
}

// ------------------------------------------------------------------ Generators
export function randomName(rng = rand, taken = []) {
  for (let i = 0; i < 20; i++) { const n = rng.pick(NAMES); if (!taken.includes(n)) return n; }
  return rng.pick(NAMES);
}

export function makeRecruit(tier, rng = rand, taken = []) {
  const bgKey = rng.weighted([['ronin', 3], ['brawler', 2], ['hunter', 2], ['guard', 2], ['shadow', 2], ['mystic', 2], ['monk', 1.5], ['farmer', 2.5]]);
  const bg = BACKGROUNDS[bgKey];
  const level = Math.max(1, tier * 2 - 1 + rng.int(-1, 1));
  const wTier = Math.max(1, Math.min(5, tier + (rng.chance(0.25) ? 1 : 0) - (bgKey === 'farmer' ? 1 : 0)));
  const u = makeUnit({
    name: randomName(rng, taken), sprite: rng.pick(bg.sprites), bg: bgKey, level,
    weapon: makeWeapon(rng.pick(bg.weapons), Math.max(1, wTier - 1), rng),
    gear: rng.chance(0.35 + tier * 0.1) ? randomGear(Math.max(1, tier - 1), rng) : null,
    quirk: rng.pick(QUIRKS),
  });
  u.cost = Math.round((bgKey === 'farmer' ? 10 : 18) + level * 12 + (u.gear ? 10 : 0) + u.weapon.tier * 4);
  return u;
}

export function makeHero(bgKey, sprite, name) {
  const bg = BACKGROUNDS[bgKey];
  const u = makeUnit({ name, sprite, bg: bgKey, level: 1, weapon: makeWeapon(bg.weapons[0], 1, rand, []) });
  u.base.hp += 6; u.base.atk += 1; u.hp = maxHp(u);
  u.hero = true;
  u.quirk = 'The one who walks alone.';
  return u;
}

export function makeMonster(key, level) {
  const m = MONSTERS[key];
  return makeUnit({ name: m.label, sprite: key, kind: 'monster', monster: key, level, team: 'enemy' });
}

export function makeBandit(def, level, rng = rand) {
  const bg = BACKGROUNDS[def.bg];
  const u = makeUnit({
    name: def.label, sprite: def.sprite, bg: def.bg, level, team: 'enemy',
    weapon: makeWeapon(rng.pick(bg.weapons), Math.max(1, Math.min(5, Math.ceil(level / 2.5))), rng),
  });
  u.isBandit = true;
  return u;
}
