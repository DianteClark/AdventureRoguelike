// Overworld scene: exploration, fog, roaming enemy groups, points of interest.
import { G, saveRun, day, hero, MAX_PARTY } from './state.js';
import { TILE } from './data.js';
import { TERR, OBJECTS, POI_ART, BIOME_NAME } from './tiles.js';
import { DIRS, astar, reachable, manhattan } from './grid.js';
import {
  view, ctx, drawGround, objectDrawable, poiArtDrawable, drawActor, drawFog, drawIcon, visibleTileRect, worldScale, toWorldTile, drawText,
} from './render.js';
import { playMusic, sfx } from './assets.js';
import { toast, modalOpen } from './ui.js';
import { maxHp } from './units.js';
import * as screens from './screens.js';
import { startBattle } from './battle.js';
import { rand } from './rng.js';
import { dust, drawParticles, shake, transition, sparks } from './fx.js';
import { BIOME } from './tiles.js';
import { drawLighting, worldLights, drawWeather, updateWeather, isNight, phase, currentBiome, WEATHER_NAME, weatherKind } from './atmosphere.js';
import { banner } from './fx.js';
import { currentMusic } from './assets.js';

const viewR = () => (isNight() ? 5 : 7);
let lastDt = 0.016;
let lastBiome = -1, lastPhase = null;
let visible = new Set();
let footprint = new Map(); // idx -> poi (tiles covered by building art)
let pathQueue = [];
let pendingInteract = null;
let animT = 0;
let lastSpotted = new Set();
let tapMark = null;

const idx = (x, y) => y * G.world.W + x;
const poiAt = (x, y) => G.world.pois.find((p) => p.x === x && p.y === y && !p.gone);
const enemyAt = (x, y) => G.world.enemies.find((e) => e.alive !== false && e.x === x && e.y === y);

export function computeFootprints() {
  footprint = new Map();
  for (const p of G.world.pois) {
    if (p.gone) continue;
    footprint.set(idx(p.x, p.y), p);
    if (!p.art) continue;
    const a = POI_ART[p.art];
    // block the whole building footprint so nothing hides behind roofs
    for (let dy = 0; dy < a.h; dy++) for (let dx = 0; dx < a.w; dx++) {
      const x = p.x - a.ax + dx, y = p.y - dy;
      if (x >= 0 && y >= 0 && x < G.world.W && y < G.world.H) footprint.set(idx(x, y), p);
    }
  }
}

export function tileBlocked(x, y, forEnemy = false) {
  const w = G.world;
  if (x < 0 || y < 0 || x >= w.W || y >= w.H) return true;
  const i = idx(x, y);
  if (w.terr[i] === TERR.WATER) return true;
  const o = w.obj[i];
  if (o >= 0 && OBJECTS[o].block) return true;
  if (footprint.has(i)) return true;
  if (forEnemy && enemyAt(x, y)) return true;
  return false;
}

export function enterWorld() {
  const fresh = G.scene !== 'world';
  G.scene = 'world';
  view.S = worldScale();
  computeFootprints();
  updateVisibility();
  centerCamera(true);
  updateWeather();
  lastBiome = currentBiome(); lastPhase = phase();
  if (fresh) playMusic(biomeMusic());
  screens.renderHud();
}

function updateVisibility() {
  visible = new Set();
  const w = G.world, { x: px, y: py } = G.player;
  const R = viewR(), r = Math.ceil(R);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > R * R) continue;
    const x = px + dx, y = py + dy;
    if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
    visible.add(idx(x, y));
    w.explored[idx(x, y)] = 1;
  }
}

function centerCamera(snap = false) {
  const tx = G.player.rx + TILE / 2 - view.w / view.S / 2;
  const ty = G.player.ry + TILE / 2 - view.h / view.S / 2;
  if (snap) { view.camX = tx; view.camY = ty; }
  else { view.camX += (tx - view.camX) * 0.2; view.camY += (ty - view.camY) * 0.2; }
  view.camX = Math.round(view.camX * view.S) / view.S;
  view.camY = Math.round(view.camY * view.S) / view.S;
}

// ------------------------------------------------------------------ Input
export function worldTap(sx, sy) {
  if (G.busy || modalOpen()) return;
  const [tx, ty] = toWorldTile(sx, sy);
  const w = G.world;
  if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) return;
  if (!w.explored[idx(tx, ty)]) { toast('Unexplored'); return; }
  const p = G.player;
  if (tx === p.x && ty === p.y) { pathQueue = []; return; }

  const enemy = visible.has(idx(tx, ty)) ? enemyAt(tx, ty) : null;
  const poi = footprint.get(idx(tx, ty));
  let target = { x: tx, y: ty };
  pendingInteract = null;
  if (enemy || poi) {
    const ix = enemy ? enemy.x : poi.x, iy = enemy ? enemy.y : poi.y;
    pendingInteract = enemy ? { enemy } : { poi };
    if (manhattan(p, { x: ix, y: iy }) === 1) { pathQueue = []; doInteract(); return; }
    // nearest adjacent free tile
    let best = null, bl = Infinity;
    for (const [dx, dy] of DIRS) {
      const ax = ix + dx, ay = iy + dy;
      if (tileBlocked(ax, ay, true)) continue;
      const path = findPath(ax, ay);
      if (path && path.length < bl) { bl = path.length; best = path; }
    }
    if (!best) { toast("Can't reach that"); pendingInteract = null; return; }
    pathQueue = best.slice(1);
    tapMark = { x: ix, y: iy, t: 0, hostile: !!enemy };
    sfx('move', 0.25);
    return;
  }
  if (tileBlocked(tx, ty)) { toast('Blocked'); return; }
  const path = findPath(tx, ty);
  if (!path) { toast("Can't get there"); return; }
  pathQueue = path.slice(1);
  tapMark = { x: tx, y: ty, t: 0 };
  sfx('move', 0.25);
}

function findPath(tx, ty) {
  const w = G.world;
  return astar(G.player.x, G.player.y, tx, ty, (x, y) => {
    if (tileBlocked(x, y)) return Infinity;
    if (!w.explored[idx(x, y)]) return 6;
    return w.terr[idx(x, y)] === TERR.ROAD ? 0.7 : 1;
  }, w.W, w.H, 8000);
}

export function worldKey(dx, dy) {
  if (G.busy || modalOpen() || G.player.moving) return;
  const nx = G.player.x + dx, ny = G.player.y + dy;
  G.player.dir = dx > 0 ? 3 : dx < 0 ? 2 : dy < 0 ? 1 : 0;
  const enemy = enemyAt(nx, ny);
  const poi = footprint.get(idx(nx, ny));
  if (enemy) { pendingInteract = { enemy }; doInteract(); return; }
  if (poi) {
    // bumping a building interacts if we're facing its door/body
    pendingInteract = { poi }; doInteract(); return;
  }
  if (tileBlocked(nx, ny)) return;
  pathQueue = [{ x: nx, y: ny }];
}

// ------------------------------------------------------------------ Update
export function biomeMusic() {
  if (isNight()) return 'night';
  const b = currentBiome();
  return b === BIOME.SNOW ? 'snow' : b === BIOME.SAND ? 'desert' : (G.world.seed % 2 ? 'world' : 'world2');
}

const BIOME_INTRO = [
  ['GREENLANDS', 'Rolling hills and old roads'],
  ['EMBER DUNES', 'The sun is merciless here'],
  ['FROSTREACH', 'Cold winds and colder blades'],
];

export function worldUpdate(dt) {
  animT += dt;
  lastDt = dt;
  if (tapMark) { tapMark.t += dt; if (tapMark.t > 0.7 && !pathQueue.length) tapMark = null; }
  for (const e of G.world.enemies) if (e.alert > 0) e.alert -= dt;
  const p = G.player;
  if (!G.busy && !modalOpen()) {
    if (!p.moving && pathQueue.length) {
      const next = pathQueue[0];
      if (tileBlocked(next.x, next.y) || enemyAt(next.x, next.y)) { pathQueue = []; }
      else {
        pathQueue.shift();
        p.dir = next.x > p.x ? 3 : next.x < p.x ? 2 : next.y < p.y ? 1 : 0;
        p.fromX = p.x; p.fromY = p.y; p.x = next.x; p.y = next.y; p.moving = 1; p.t = 0;
      }
    } else if (!p.moving && !pathQueue.length && pendingInteract) {
      doInteract();
    }
  }
  if (p.moving) {
    p.t += dt / 0.13;
    const t = Math.min(1, p.t);
    p.rx = (p.fromX + (p.x - p.fromX) * t) * TILE;
    p.ry = (p.fromY + (p.y - p.fromY) * t) * TILE;
    if (t >= 1) { p.moving = 0; onStep(); }
  } else { p.rx = p.x * TILE; p.ry = p.y * TILE; }
  for (const e of G.world.enemies) {
    if (e.alive === false) continue;
    if (e.rx == null) { e.rx = e.x * TILE; e.ry = e.y * TILE; }
    e.rx += (e.x * TILE - e.rx) * Math.min(1, dt * 12);
    e.ry += (e.y * TILE - e.ry) * Math.min(1, dt * 12);
  }
  centerCamera();
}

const DUST = ['#c7d97a', '#e8b878', '#ffffff'];
function onStep() {
  G.steps++;
  dust(G.player.fromX * TILE + 8, G.player.fromY * TILE + 15, DUST[G.world.biome[idx(G.player.x, G.player.y)]]);
  const before = day();
  const b = currentBiome();
  if (b !== lastBiome) {
    lastBiome = b;
    banner(BIOME_INTRO[b][0], { color: ['#9be06a', '#ffb45a', '#bfe6ff'][b], sub: BIOME_INTRO[b][1], dur: 2.2, size: 0.8 });
    if (!isNight()) playMusic(biomeMusic());
  }
  const ph = phase();
  if (ph !== lastPhase) {
    if (ph === 'night') { banner('NIGHTFALL', { color: '#9fb4ff', sub: 'Vision shrinks. Monsters roam bolder.', dur: 2, size: 0.7 }); playMusic('night'); }
    if (ph === 'dawn') { banner('DAWN', { color: '#ffd29a', sub: `Day ${day()}`, dur: 1.8, size: 0.7 }); playMusic(biomeMusic()); }
    lastPhase = ph;
  }
  updateWeather();
  if (G.steps % 5 === 0) for (const u of G.party) if (u.alive) u.hp = Math.min(maxHp(u), u.hp + 1);
  updateVisibility();
  moveEnemies();

  screens.renderHud();
  if (G.steps % 8 === 0) saveRun();

  // contact?
  const contact = G.world.enemies.find((e) => e.alive !== false && manhattan(e, G.player) <= 1);
  if (contact) { pathQueue = []; pendingInteract = null; engage(contact); return; }

  // newly spotted enemies interrupt long walks
  const spotted = G.world.enemies.filter((e) => e.alive !== false && visible.has(idx(e.x, e.y)) && manhattan(e, G.player) <= 5);
  const fresh = spotted.filter((e) => !lastSpotted.has(e.id));
  lastSpotted = new Set(spotted.map((e) => e.id));
  if (fresh.length && pathQueue.length > 0) {
    pathQueue = [];
    pendingInteract = null;
    sfx('alert', 0.5);
    toast(`${fresh[0].name} spotted!`);
    return;
  }

  // random road events
  if (!pathQueue.length || rand.chance(0.5)) {
    if (G.steps > 25 && G.steps - (G.flags.lastEventStep || 0) > 30 && rand.chance(0.035) && !spotted.length) {
      G.flags.lastEventStep = G.steps;
      pathQueue = []; pendingInteract = null;
      screens.randomTravelEvent();
    }
  }
}

function moveEnemies() {
  const w = G.world, p = G.player;
  // distance field from player for chasers
  const field = reachable(p.x, p.y, 14, (x, y) => !tileBlocked(x, y));
  const distTo = (x, y) => { const n = field.get(field.key(x, y)); return n ? n.d : Infinity; };
  for (const e of w.enemies) {
    if (e.alive === false || e.static) continue;
    const d = manhattan(e, p);
    if (d > 18) continue;
    const seen = visible.has(idx(e.x, e.y));
    if (seen && d <= (isNight() ? 8 : 6)) {
      if (!(e.chase > 0)) { e.alert = 1.2; sfx('alert', 0.3); }
      e.chase = 7;
    }
    if (e.chase > 0) {
      e.chase--;
      // slower packs pause occasionally so a careful player can slip away
      if (rand.chance(0.18)) continue;
      let best = null, bd = distTo(e.x, e.y);
      for (const [dx, dy] of DIRS) {
        const nx = e.x + dx, ny = e.y + dy;
        if (tileBlocked(nx, ny, true) || (nx === p.x && ny === p.y)) continue;
        const nd = distTo(nx, ny);
        if (nd < bd) { bd = nd; best = [nx, ny]; }
      }
      if (best) { e.x = best[0]; e.y = best[1]; }
    } else if (rand.chance(0.35)) {
      const [dx, dy] = rand.pick(DIRS);
      const nx = e.x + dx, ny = e.y + dy;
      if (!tileBlocked(nx, ny, true) && !(nx === p.x && ny === p.y) && Math.abs(nx - e.hx) + Math.abs(ny - e.hy) <= 6) { e.x = nx; e.y = ny; }
    }
  }
}

function doInteract() {
  const it = pendingInteract;
  pendingInteract = null;
  if (!it) return;
  if (it.enemy) {
    if (it.enemy.alive === false) return;
    if (manhattan(it.enemy, G.player) <= 1) engage(it.enemy);
    return;
  }
  const poi = it.poi;
  if (!poi || poi.gone) return;
  // face it
  const dx = poi.x - G.player.x, dy = poi.y - G.player.y;
  G.player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy < 0 ? 1 : 0);
  screens.interactPoi(poi);
}

function engage(enemy) {
  G.busy = true;
  sfx('alert', 0.7);
  enemy.alert = 1.5;
  shake(3, 0.3);
  setTimeout(() => {
    transition(() => {
      G.busy = false;
      startBattle({
        members: enemy.members, name: enemy.name, anchor: { x: enemy.x, y: enemy.y }, tier: enemy.tier,
        champion: enemy.champion, elite: !!enemy.champion, lootBonus: enemy.champion ? 1 : 0,
        onWin: () => { enemy.alive = false; },
      });
    });
  }, 380);
}

export function stopWalking() { pathQueue = []; pendingInteract = null; }

// ------------------------------------------------------------------ Render
export function worldRender() {
  const w = G.world;
  drawGround(G.ground);
  drawWaterShimmer();
  drawPathPreview();
  drawWorldObjects(null);
  drawParticles();
  drawLighting(worldLights());
  drawFog(w, visible);
  drawWeather(lastDt);
}

function drawPathPreview() {
  if (tapMark) {
    const k = (Math.sin(tapMark.t * 10) + 1) / 2;
    const [sx, sy] = toScreenTile(tapMark.x, tapMark.y);
    const S = view.S;
    ctx.strokeStyle = tapMark.hostile ? `rgba(255,90,80,${0.9 - k * 0.4})` : `rgba(255,240,180,${0.9 - k * 0.4})`;
    ctx.lineWidth = S;
    const inset = (1 + k * 2) * S;
    ctx.strokeRect(sx + inset, sy + inset, TILE * S - inset * 2, TILE * S - inset * 2);
  }
  if (pathQueue.length) {
    ctx.fillStyle = 'rgba(255,240,180,0.55)';
    const S = view.S;
    for (let i = 0; i < pathQueue.length; i++) {
      const p = pathQueue[i];
      const [sx, sy] = toScreenTile(p.x, p.y);
      ctx.fillRect(sx + 7 * S, sy + 7 * S, 2 * S, 2 * S);
    }
  }
}
const toScreenTile = (x, y) => [Math.round((x * TILE - view.camX) * view.S), Math.round((y * TILE - view.camY) * view.S)];

// twinkles on water tiles
function drawWaterShimmer() {
  const w = G.world, r = visibleTileRect(w), S = view.S;
  const t = Math.floor(animT * 3);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const i = idx(x, y);
    if (w.terr[i] !== TERR.WATER || !w.explored[i]) continue;
    const h = ((x * 73856093) ^ (y * 19349663) ^ (t * 83492791)) >>> 0;
    if (h % 9 !== 0) continue;
    const px = 3 + (h >> 4) % 10, py = 3 + (h >> 8) % 10;
    const [sx, sy] = toScreenTile(x, y);
    ctx.fillRect(sx + px * S, sy + py * S, 2 * S, S);
  }
}

// Shared by battle: draws objects, POIs and given units sorted by depth.
export function drawWorldObjects(extraDrawables, opts = {}) {
  const w = G.world;
  const r = visibleTileRect(w);
  const list = [];
  for (let y = r.y0; y <= r.y1 + 1 && y < w.H; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
    if (x < 0 || x >= w.W) continue;
    const o = w.obj[idx(x, y)];
    if (o >= 0 && !OBJECTS[o].decal) list.push(objectDrawable(OBJECTS[o], x, y));
  }
  for (const p of w.pois) {
    if (p.gone || p.x < r.x0 - 4 || p.x > r.x1 + 4 || p.y < r.y0 - 1 || p.y > r.y1 + 4) continue;
    if (!opts.battle && !w.explored[idx(p.x, p.y)]) continue;
    if (opts.battle && p.type === 'boss') continue;
    list.push(poiDrawable(p));
  }
  if (!opts.battle) {
    for (const e of w.enemies) {
      if (e.alive === false || !visible.has(idx(e.x, e.y))) continue;
      const frame = Math.floor(animT * 4 + e.x) % 4;
      list.push({
        z: e.ry + TILE * 2, draw: () => {
          drawActor(e.leader, e.rx, e.ry, 0, e.leader.kind === 'monster' ? frame : 0, { ring: e.champion ? `rgba(255,200,60,${0.45 + Math.sin(animT * 5) * 0.2})` : 'rgba(255,60,60,.35)' });
          const n = e.members.length;
          drawText(`${n}`, e.rx + 15, e.ry + 2, e.champion ? '#ffd23d' : '#ffd27a', 6);
          if (e.champion) drawText('♛', e.rx + 8, e.ry - 4, '#ffd23d', 7);
          if (e.alert > 0) drawIcon('Ui/Emote/emote22.png', e.rx + 2, e.ry - 17 - Math.max(0, e.alert - 1) * 10, 12);
        },
      });
    }
    const p = G.player;
    const h = hero();
    const pf = p.moving ? Math.floor(p.t * 2) % 4 : 0;
    list.push({ z: p.ry + TILE * 2 + 0.1, draw: () => drawActor(h.sprite ? { kind: 'char', name: h.sprite } : { kind: 'char', name: 'NinjaBlue' }, p.rx, p.ry, p.dir, p.moving ? (pf + 1) % 4 : 0, { ring: 'rgba(80,170,255,.35)' }) });
  }
  if (extraDrawables) list.push(...extraDrawables);
  list.sort((a, b) => a.z - b.z);
  for (const d of list) d.draw();
}

function poiDrawable(p) {
  if (p.type === 'chest') {
    return { z: (p.y + 1) * TILE - 0.3, draw: () => drawIcon('Items/Treasure/LittleTreasureChest.png', p.x * TILE, p.y * TILE + 1, 15, 16) };
  }
  if (p.type === 'wanderer') {
    return {
      z: (p.y + 1) * TILE - 0.3, draw: () => {
        drawActor({ kind: 'char', name: p.sprite }, p.x * TILE, p.y * TILE, 0, 0);
        if (Math.floor(animT * 2) % 2 === 0) drawIcon('Ui/Emote/emote20.png', p.x * TILE + 2, p.y * TILE - 15, 12);
      },
    };
  }
  if (p.type === 'boss') {
    return {
      z: (p.y + 1) * TILE + 0.5, draw: () => {
        if (p.cleared) { drawIcon('Ui/Emote/emote29.png', p.x * TILE + 2, p.y * TILE - 6, 12); return; }
        drawActor({ kind: 'boss', name: p.boss }, p.x * TILE, p.y * TILE, 0, 0, { ring: `rgba(255,40,80,${0.35 + Math.sin(animT * 3) * 0.15})` });
        drawIcon('Ui/Emote/emote22.png', p.x * TILE + 2, p.y * TILE - 46 + Math.sin(animT * 4) * 2, 12);
      },
    };
  }
  if (p.type === 'skygate') {
    return poiArtDrawable('torii', p.x, p.y, () => {
      if (!p.locked) {
        const k = (Math.sin(animT * 3) + 1) / 2;
        drawText('✦', p.x * TILE + 8, (p.y - 1) * TILE + 6, `rgba(255,220,120,${0.5 + k * 0.5})`, 10);
      }
      drawText(p.locked ? 'Sky Gate (sealed)' : 'SKY GATE', p.x * TILE + 8, (p.y - 2) * TILE + 4, p.locked ? '#9fb4ff' : '#ffd27a', 6, 0.9);
    }, p.locked);
  }
  const faded = (p.type === 'shrine' && p.used) || (p.type === 'den' && p.cleared);
  return poiArtDrawable(p.art, p.x, p.y, () => {
    if (p.type === 'den' && !p.cleared) drawIcon('Ui/Emote/emote22.png', p.x * TILE + 2, p.y * TILE - 26, 12);
    if (p.type === 'shrine' && !p.used && Math.floor(animT * 2) % 2 === 0) drawIcon('Ui/Emote/emote23.png', p.x * TILE + 2, p.y * TILE - 22, 12);
    if (p.type === 'village' && p.name) drawText(p.name, p.x * TILE + 8, (p.y - 2) * TILE - 2, '#ffe9b0', 6, 0.9);
  }, faded);
}

export const worldVisible = () => visible;
export const currentBiomeName = () => BIOME_NAME[G.world.biome[idx(G.player.x, G.player.y)]];

// testing helper
export function debugTeleport(x, y) {
  G.player.x = x; G.player.y = y; G.player.rx = x * TILE; G.player.ry = y * TILE;
  pathQueue = []; pendingInteract = null;
  updateVisibility(); centerCamera(true);
}
