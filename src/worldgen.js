// Procedural world generation.
import { RNG, fbm } from './rng.js';
import { BIOME, TERR, OBJECTS, BIOME_OBJ, BIOME_CODE } from './tiles.js';
import { astar, DIRS } from './grid.js';
import { MONSTERS, BANDITS } from './data.js';

export const WORLD_W = 72, WORLD_H = 72;

export function generateWorld(seed) {
  const rng = new RNG(seed);
  const W = WORLD_W, H = WORLD_H, N = W * H;
  const biome = new Uint8Array(N), terr = new Uint8Array(N), variant = new Uint8Array(N);
  const obj = new Int16Array(N).fill(-1);
  const idx = (x, y) => y * W + x;

  // --- terrain
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const t = y / H + (fbm(x / 14, y / 14, seed + 3) - 0.5) * 0.3;
    biome[i] = t < 0.27 ? BIOME.SNOW : t > 0.73 ? BIOME.SAND : BIOME.GRASS;
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    let e = fbm(x / 9, y / 9, seed);
    if (edge < 7) e -= ((7 - edge) / 7) * 0.55;
    const m = fbm(x / 7, y / 7, seed + 17);
    variant[i] = rng.chance(0.82) ? 0 : rng.int(1, 4);
    if (e < 0.3) { terr[i] = TERR.WATER; continue; }
    const bo = BIOME_OBJ[biome[i]];
    if (e > 0.7) {
      obj[i] = rng.chance(0.55) ? rng.pick(bo.rocks) : rng.pick(bo.stones);
    } else if (m > (biome[i] === BIOME.SAND ? 0.7 : 0.6) && rng.chance(biome[i] === BIOME.SAND ? 0.45 : 0.78)) {
      obj[i] = rng.pick(bo.trees);
    } else if (rng.chance(0.025)) {
      obj[i] = rng.pick(bo.trees);
    } else if (rng.chance(0.045)) {
      obj[i] = rng.pick(bo.bushes);
    } else if (bo.decals.length && rng.chance(0.05)) {
      obj[i] = rng.pick(bo.decals);
    }
  }
  // remove 1-tile puddles and thin water noise
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = idx(x, y);
    if (terr[i] !== TERR.WATER) continue;
    let n = 0;
    for (const [dx, dy] of DIRS) if (terr[idx(x + dx, y + dy)] === TERR.WATER) n++;
    if (n <= 1) terr[i] = TERR.GROUND;
  }

  const inb = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;
  const blocked = (x, y) => terr[idx(x, y)] === TERR.WATER || (obj[idx(x, y)] >= 0 && OBJECTS[obj[idx(x, y)]].block);
  const clearArea = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const i = idx(nx, ny);
      if (terr[i] === TERR.WATER) terr[i] = TERR.GROUND;
      if (obj[i] >= 0 && !OBJECTS[obj[i]].decal) obj[i] = -1;
    }
  };

  // --- start: middle band, open ground
  let start = { x: W >> 1, y: H >> 1 };
  for (let tries = 0; tries < 400; tries++) {
    const x = rng.int(W * 0.35, W * 0.65), y = rng.int(H * 0.42, H * 0.58);
    if (!blocked(x, y) && biome[idx(x, y)] === BIOME.GRASS) { start = { x, y }; break; }
  }
  clearArea(start.x, start.y, 1);

  // --- POI placement helpers
  const pois = [];
  const farFromPois = (x, y, d) => pois.every((p) => Math.abs(p.x - x) + Math.abs(p.y - y) >= d);
  const findSpot = (filter, minD = 6, tries = 600) => {
    for (let t = 0; t < tries; t++) {
      const x = rng.int(4, W - 5), y = rng.int(5, H - 4);
      if (blocked(x, y) || !farFromPois(x, y, minD) || !filter(x, y)) continue;
      return { x, y };
    }
    return null;
  };
  const distStart = (x, y) => Math.abs(x - start.x) + Math.abs(y - start.y);

  // --- villages
  let vid = 0;
  const addVillage = (spot) => {
    clearArea(spot.x, spot.y, 2);
    const b = biome[idx(spot.x, spot.y)];
    const art = b === BIOME.SNOW ? rng.pick(['igloo1', 'igloo2']) : b === BIOME.SAND ? rng.pick(['tent', 'hut', 'house2']) : rng.pick(['house1', 'house3', 'house4', 'house2']);
    pois.push({ id: `v${vid++}`, type: 'village', x: spot.x, y: spot.y, art, name: villageName(rng), visited: false });
  };
  const near = findSpot((x, y) => distStart(x, y) >= 3 && distStart(x, y) <= 7, 2) || { x: start.x + 4, y: start.y };
  addVillage(near);
  for (let i = 0; i < 6; i++) { const s = findSpot((x, y) => distStart(x, y) > 12, 14); if (s) addVillage(s); }

  // --- roads connecting villages (A* through cheap terrain, carving obstacles)
  const villages = pois.filter((p) => p.type === 'village');
  const connected = [villages[0]];
  const roadCost = (x, y) => {
    if (!inb(x, y)) return Infinity;
    const i = idx(x, y);
    if (terr[i] === TERR.ROAD) return 0.4;
    if (terr[i] === TERR.WATER) return 9;
    if (obj[i] >= 0 && OBJECTS[obj[i]].block) return 4;
    return 1;
  };
  const carve = (path) => {
    for (const p of path) {
      const i = idx(p.x, p.y);
      terr[i] = TERR.ROAD;
      if (obj[i] >= 0) obj[i] = -1;
    }
  };
  // start connects to first village
  const sp = astar(start.x, start.y, villages[0].x, villages[0].y + 1, roadCost, W, H);
  if (sp) carve(sp);
  for (const v of villages.slice(1)) {
    let best = null, bd = Infinity;
    for (const c of connected) { const d = Math.abs(c.x - v.x) + Math.abs(c.y - v.y); if (d < bd) { bd = d; best = c; } }
    const path = astar(v.x, v.y + 1, best.x, best.y + 1, roadCost, W, H, 40000);
    if (path) carve(path);
    connected.push(v);
  }
  // villages' own tiles are not road
  for (const v of villages) terr[idx(v.x, v.y)] = TERR.GROUND;

  // --- reachability from start
  const reach = new Uint8Array(N);
  const q = [[start.x, start.y]]; reach[idx(start.x, start.y)] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || reach[idx(nx, ny)] || blocked(nx, ny)) continue;
      reach[idx(nx, ny)] = 1; q.push([nx, ny]);
    }
  }
  const reachable = (x, y) => reach[idx(x, y)] === 1;

  // --- other POIs
  let pid = 0;
  const add = (type, n, minDist, extra) => {
    for (let i = 0; i < n; i++) {
      const s = findSpot((x, y) => reachable(x, y) && distStart(x, y) >= minDist, 7);
      if (!s) continue;
      const b = biome[idx(s.x, s.y)];
      pois.push({ id: `${type}${pid++}`, type, x: s.x, y: s.y, biome: b, used: false, ...extra(s, b) });
    }
  };
  add('shrine', 7, 6, () => ({ art: rng.pick(['statueOrb', 'statueSit', 'torii']) }));
  add('den', 6, 14, (s, b) => ({
    art: b === BIOME.SNOW ? rng.pick(['denStone', 'denCrystal']) : b === BIOME.SAND ? rng.pick(['denRed', 'denRuin']) : rng.pick(['denWood', 'denHut', 'denDome']),
  }));
  add('chest', 12, 4, () => ({}));
  add('wanderer', 8, 5, () => ({ sprite: rng.pick(['OldMan', 'OldMan3', 'OldWoman', 'Monk2', 'Inspector', 'Noble', 'Sultan', 'Princess', 'Woman', 'Villager6', 'Eskimo', 'Master', 'Tengu', 'Child']) }));
  // dens are guarded by strong groups; give them a tier
  for (const p of pois) if (p.type === 'den') p.tier = Math.min(5, tierAt(p.x, p.y, start, biome[idx(p.x, p.y)]) + 1);
  // block tiles under building art except the door tile
  for (const p of pois) {
    if (p.type === 'village' || p.type === 'den' || p.type === 'shrine') clearArea(p.x, p.y, 0);
  }

  // --- enemy groups
  const enemies = [];
  let eid = 0;
  for (let i = 0; i < 34; i++) {
    const s = findSpot((x, y) => reachable(x, y) && distStart(x, y) >= 9 && enemies.every((e) => Math.abs(e.x - x) + Math.abs(e.y - y) > 5), 3);
    if (!s) continue;
    const b = biome[idx(s.x, s.y)];
    const tier = tierAt(s.x, s.y, start, b);
    enemies.push({ id: `e${eid++}`, x: s.x, y: s.y, hx: s.x, hy: s.y, tier, ...makeGroup(tier, b, rng), chase: 0 });
  }
  // den guards (static)
  for (const p of pois.filter((p) => p.type === 'den')) {
    const g = makeGroup(p.tier, p.biome, rng, true);
    p.group = g;
  }

  return {
    seed, W, H, biome, terr, variant, obj, pois, enemies, start,
    explored: new Uint8Array(N), reach,
  };
}

export function tierAt(x, y, start, b) {
  const d = Math.abs(x - start.x) + Math.abs(y - start.y);
  let t = 1 + Math.floor(Math.max(0, d - 6) / 11);
  if (b !== BIOME.GRASS) t += 1;
  return Math.max(1, Math.min(5, t));
}

// A group: leader sprite for the map + member specs for battle
export function makeGroup(tier, b, rng, elite = false) {
  const code = BIOME_CODE[b];
  const useBandits = tier >= 2 && rng.chance(0.28);
  const size = Math.min(6, 1 + Math.floor(tier * 0.8) + rng.int(0, 1) + (elite ? 1 : 0));
  const members = [];
  if (useBandits) {
    const pool = BANDITS.filter((d) => d.t <= tier && d.t >= tier - 2);
    for (let i = 0; i < size; i++) {
      const d = rng.pick(pool);
      members.push({ type: 'bandit', key: d.sprite, level: levelFor(tier, rng, elite) });
    }
    members.sort((a, b2) => BANDITS.find((d) => d.sprite === b2.key).t - BANDITS.find((d) => d.sprite === a.key).t);
    return { leader: { kind: 'char', name: members[0].key }, members, name: 'Bandits' };
  }
  const pool = Object.entries(MONSTERS).filter(([, m]) => m.biomes.includes(code));
  const fit = pool.filter(([, m]) => m.t <= tier && m.t >= tier - 2);
  const top = pool.filter(([, m]) => m.t === tier);
  const leaderKey = (top.length ? rng.pick(top) : rng.pick(fit.length ? fit : pool))[0];
  members.push({ type: 'monster', key: leaderKey, level: levelFor(tier, rng, elite) + 1 });
  // packs often share a species
  const species = rng.chance(0.5) ? leaderKey : null;
  for (let i = 1; i < size; i++) {
    const lowerPool = fit.filter(([, m]) => m.t <= Math.max(1, tier - (rng.chance(0.6) ? 1 : 0)));
    const k = species && rng.chance(0.6) ? species : rng.pick(lowerPool.length ? lowerPool : fit.length ? fit : pool)[0];
    members.push({ type: 'monster', key: k, level: levelFor(tier, rng, elite) });
  }
  return { leader: { kind: 'monster', name: leaderKey }, members, name: MONSTERS[leaderKey].label + (size > 1 ? ' pack' : '') };
}

function levelFor(tier, rng, elite) {
  return Math.max(1, tier * 2 - 2 + rng.int(0, 1) + (elite ? 1 : 0));
}

function villageName(rng) {
  const a = ['Mizu', 'Kaze', 'Hoshi', 'Tsuki', 'Ishi', 'Kawa', 'Yama', 'Mori', 'Sakura', 'Kita', 'Minami', 'Kuro', 'Shiro', 'Aka', 'Ao', 'Hi'];
  const b = ['mura', 'gawa', 'zaka', 'hara', 'no-sato', 'shima', 'dera', 'tani', 'kubo', 'oka'];
  return rng.pick(a) + rng.pick(b);
}
