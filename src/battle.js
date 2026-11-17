// Tactical grid battles fought on the overworld terrain where the encounter happened.
import { G, hero, saveRun } from './state.js';
import { TILE, MONSTERS, BANDITS, FAMILY_FX } from './data.js';
import { OBJECTS, TERR } from './tiles.js';
import { DIRS, reachable, pathFromReach, manhattan } from './grid.js';
import {
  view, ctx, drawGround, drawActor, drawHpBar, fillTile, strokeTile, drawFx, drawText, toWorldTile,
} from './render.js';
import { drawWorldObjects, tileBlocked } from './world.js';
import { stats, maxHp, makeMonster, makeBandit, gainXp } from './units.js';
import { playMusic, sfx } from './assets.js';
import { rand } from './rng.js';
import * as screens from './screens.js';
import { toast, modalOpen } from './ui.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let B = null; // current battle
let time = 0;

// ------------------------------------------------------------------ Setup
export function startBattle(opts) {
  const w = G.world;
  const portrait = window.innerHeight >= window.innerWidth;
  const availW = window.innerWidth, availH = window.innerHeight - 214;
  let BW, BH;
  if (portrait) { BW = 9; BH = Math.max(10, Math.min(14, Math.floor(9 * availH / availW))); }
  else { BH = 9; BW = Math.max(11, Math.min(17, Math.floor(9 * availW / Math.max(200, availH)))); }

  const P = { x: G.player.x, y: G.player.y };
  let A = { ...opts.anchor };
  // keep foes a few tiles away at the start
  if (manhattan(P, A) < 4) {
    const dx = Math.sign(A.x - P.x), dy = Math.sign(A.y - P.y);
    for (let k = 4; k >= 1; k--) {
      const nx = A.x + dx * k, ny = A.y + dy * k;
      if (!tileBlocked(nx, ny)) { A = { x: nx, y: ny }; break; }
    }
  }
  const cx = Math.round((P.x + A.x) / 2), cy = Math.round((P.y + A.y) / 2);
  const rect = {
    x: Math.max(0, Math.min(w.W - BW, cx - Math.floor(BW / 2))),
    y: Math.max(0, Math.min(w.H - BH, cy - Math.floor(BH / 2))),
    w: BW, h: BH,
  };
  const inRect = (x, y) => x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
  const walk = (x, y) => inRect(x, y) && !tileBlocked(x, y);

  // connected area around the player
  const comp = reachable(P.x, P.y, 99, walk);
  const tiles = [...comp.values()].map((n) => ({ x: n.x, y: n.y }));
  const dP = (t) => manhattan(t, P), dA = (t) => manhattan(t, A);

  const party = G.party.filter((u) => u.alive && u.hp > 0);
  const used = new Set();
  const take = (list) => { for (const t of list) { const k = t.y * 1000 + t.x; if (!used.has(k)) { used.add(k); return t; } } return null; };

  const units = [];
  let pt = tiles.filter((t) => dP(t) <= dA(t)).sort((a, b) => dP(a) - dP(b));
  if (pt.length < party.length) pt = tiles.slice().sort((a, b) => dP(a) - dP(b));
  for (const u of party) {
    const t = take(pt); if (!t) break;
    units.push(wrap(u, 'player', t));
  }
  const foes = opts.members.map((m) => {
    if (m.type === 'bandit') return makeBandit(BANDITS.find((d) => d.sprite === m.key), m.level);
    return makeMonster(m.key, m.level);
  });
  let et = tiles.filter((t) => dA(t) < dP(t) && units.every((pu) => manhattan(pu, t) >= 3)).sort((a, b) => dA(a) - dA(b));
  if (et.length < foes.length) et = tiles.filter((t) => units.every((pu) => manhattan(pu, t) >= 2)).sort((a, b) => dA(a) - dA(b));
  if (et.length < foes.length) et = tiles.slice().sort((a, b) => dA(a) - dA(b));
  for (const f of foes) {
    const t = take(et); if (!t) break;
    units.push(wrap(f, 'enemy', t));
  }

  B = {
    rect, units, phase: 'player', turn: 1, state: 'idle', sel: null, reach: null, targets: [], heals: [],
    fx: [], texts: [], opts, name: opts.name, tier: opts.tier || 1, elite: !!opts.elite, xp: new Map(), busy: false,
    inspect: null,
  };
  G.battle = B;
  G.scene = 'battle';
  G.stats.battles++;
  fitCamera();
  playMusic(rand.chance(0.5) ? 'battle' : 'battle2');
  sfx('alert', 0.5);
  screens.renderHud();
  renderBattleUi();
  banner(`${opts.name}!`);
  setTimeout(() => banner('Your turn'), 1100);
}

function wrap(u, team, t) {
  return {
    u, team, x: t.x, y: t.y, rx: t.x * TILE, ry: t.y * TILE, dir: team === 'player' ? 1 : 0,
    moved: false, acted: false, lastStandUsed: false, flash: 0, pose: null, lunge: null, dead: false,
    sprite: u.kind === 'monster' ? { kind: 'monster', name: u.sprite } : { kind: 'char', name: u.sprite },
  };
}

export function fitCamera() {
  if (!B) return;
  const portrait = window.innerHeight >= window.innerWidth;
  const top = 64 * view.dpr, bottom = (portrait ? 150 : 80) * view.dpr;
  const availH = view.h - top - bottom, availW = view.w - 8 * view.dpr;
  view.S = Math.max(1, Math.floor(Math.min(availW / (B.rect.w * TILE), availH / (B.rect.h * TILE))));
  const pw = B.rect.w * TILE * view.S, ph = B.rect.h * TILE * view.S;
  view.camX = B.rect.x * TILE - (view.w - pw) / 2 / view.S;
  view.camY = B.rect.y * TILE - (top + (availH - ph) / 2) / view.S;
}

// ------------------------------------------------------------------ Queries
const alive = (team) => B.units.filter((b) => !b.dead && (!team || b.team === team));
const unitAt = (x, y) => B.units.find((b) => !b.dead && b.x === x && b.y === y);
const inRect = (x, y) => x >= B.rect.x && y >= B.rect.y && x < B.rect.x + B.rect.w && y < B.rect.y + B.rect.h;
function terrainOk(x, y, fly) {
  if (!inRect(x, y)) return false;
  if (!fly) return !tileBlocked(x, y);
  const w = G.world, i = y * w.W + x, o = w.obj[i];
  if (o >= 0 && OBJECTS[o].block) return OBJECTS[o].kind === 'rock'; // flyers pass stones, not trees
  if (w.terr[i] === TERR.WATER) return true;
  return !tileBlocked(x, y);
}
function coverAt(x, y) {
  const o = G.world.obj[y * G.world.W + x];
  return o >= 0 && OBJECTS[o].cover ? 15 : 0;
}

function moveReach(b) {
  const s = stats(b.u);
  return reachable(b.x, b.y, s.mov, (x, y) => {
    if (!terrainOk(x, y, s.fly)) return false;
    const o = unitAt(x, y);
    return !o || o.team === b.team; // pass through allies
  }, (x, y) => !unitAt(x, y));
}

function inRange(from, to, range) {
  const d = manhattan(from, to);
  return d >= range[0] && d <= range[1];
}

// ------------------------------------------------------------------ Combat math
export function forecast(att, def) {
  const a = stats(att.u), d = stats(def.u);
  const one = (A, D, aw, dw) => {
    const hit = Math.max(5, Math.min(100, 85 + A.acc - D.dodge - coverAt(dw.x, dw.y)));
    const effDef = A.magic ? Math.floor(D.def / 2) : Math.max(0, D.def - A.sunder);
    let dmg = Math.max(1, A.atk - effDef);
    if (A.execute && dw.u.hp < maxHp(dw.u) * 0.35) dmg = Math.round(dmg * (1 + A.execute));
    let strikes = 1;
    if (A.twin) { dmg = Math.max(1, Math.round(dmg * 0.6)); strikes = 2; }
    return { hit, dmg, crit: Math.max(0, Math.min(60, A.crit)), strikes };
  };
  const res = one(a, d, att, def);
  const canCounter = !def.dead && inRange(def, att, d.range) && !(d.heals && false);
  res.counter = canCounter ? one(d, a, def, att) : null;
  return res;
}

function dealDamage(target, dmg, source) {
  const s = stats(target.u);
  if (target.u.hp - dmg <= 0 && s.lastStand && !target.lastStandUsed) {
    target.lastStandUsed = true;
    target.u.hp = 1;
    floatText(target, 'Endure!', '#ffd27a');
    return false;
  }
  target.u.hp = Math.max(0, target.u.hp - dmg);
  return target.u.hp <= 0;
}

async function strike(att, def, info, isCounter = false) {
  const a = stats(att.u);
  const fam = a.family;
  let fxKind = att.u.monster ? MONSTERS[att.u.monster].fx : (FAMILY_FX[fam] || 'slash');
  face(att, def);
  att.pose = 'attack';
  const ranged = manhattan(att, def) > 1;
  att.lunge = ranged ? null : { dx: Math.sign(def.x - att.x), dy: Math.sign(def.y - att.y), t: 0 };
  sfx(ranged ? (a.magic ? 'magic' : 'shoot') : (fam === 'heavy' ? 'slash2' : 'slash'), 0.7);
  await wait(160);
  let killed = false;
  for (let s = 0; s < info.strikes && !def.dead && !killed; s++) {
    const hitRoll = rand.int(1, 100) <= info.hit;
    B.fx.push({ kind: fxKind, x: def.x, y: def.y, t: 0, dur: 0.38 });
    if (!hitRoll) { floatText(def, 'Miss', '#cfd8ff'); sfx('cancel', 0.4); }
    else {
      const crit = rand.int(1, 100) <= info.crit;
      let dmg = Math.max(1, Math.round(info.dmg * (crit ? 1.5 : 1) * rand.float(0.9, 1.1)));
      killed = dealDamage(def, dmg, att);
      def.flash = 0.25;
      sfx(crit ? 'impact' : 'hit', 0.8);
      floatText(def, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd27a' : '#ffffff', crit ? 10 : 8);
      addXp(att, 6);
      if (a.lifesteal > 0) heal(att, Math.max(1, Math.round(dmg * a.lifesteal)), false);
      const ds = stats(def.u);
      if (ds.thorns && !ranged && !att.dead) {
        await wait(120);
        const k2 = dealDamage(att, ds.thorns, def);
        floatText(att, `${ds.thorns}`, '#ff9b6b'); att.flash = 0.2;
        if (k2) { await kill(att, def); }
      }
      // polearm: hit the one standing behind
      if (a.pierce && !isCounter) {
        const bx = def.x + Math.sign(def.x - att.x), by = def.y + Math.sign(def.y - att.y);
        const behind = unitAt(bx, by);
        if (behind && behind.team !== att.team) {
          const d2 = Math.max(1, Math.round(dmg * 0.6));
          B.fx.push({ kind: 'pierce', x: bx, y: by, t: 0, dur: 0.38 });
          const k3 = dealDamage(behind, d2, att);
          behind.flash = 0.25; floatText(behind, `${d2}`, '#ffffff');
          if (k3) await kill(behind, att);
        }
      }
    }
    await wait(260);
  }
  att.pose = null; att.lunge = null;
  if (killed) await kill(def, att);
  return killed;
}

async function kill(victim, killer) {
  if (victim.dead) return;
  victim.dead = true;
  victim.u.hp = 0;
  B.fx.push({ kind: 'smoke', x: victim.x, y: victim.y, t: 0, dur: 0.5 });
  sfx('explosion', 0.35);
  if (killer && !killer.dead) {
    const ks = stats(killer.u);
    if (killer.team === 'player') { addXp(killer, 18 + victim.u.level * 7); killer.u.kills = (killer.u.kills || 0) + 1; G.stats.kills++; }
    if (ks.healOnKill) heal(killer, ks.healOnKill, false);
  }
  if (victim.team === 'player') {
    victim.u.alive = false;
    toast(victim.u.hero ? `${victim.u.name} has fallen...` : `${victim.u.name} has fallen.`);
  }
  await wait(250);
}

function heal(b, amount, show = true) {
  const before = b.u.hp;
  b.u.hp = Math.min(maxHp(b.u), b.u.hp + amount);
  const got = b.u.hp - before;
  if (got > 0) floatText(b, `+${got}`, '#8fe07a');
  return got;
}

function addXp(b, n) { if (b.team === 'player') B.xp.set(b, (B.xp.get(b) || 0) + n); }

function face(a, t) {
  const dx = t.x - a.x, dy = t.y - a.y;
  a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy < 0 ? 1 : 0);
}

function floatText(b, text, color, size = 8) {
  B.texts.push({ x: b.x * TILE + 8, y: b.y * TILE - 2, text, color, size, t: 0 });
}

async function attack(att, def) {
  B.busy = true;
  const info = forecast(att, def);
  await strike(att, def, info);
  if (!def.dead && !att.dead && info.counter) {
    await wait(120);
    await strike(def, att, info.counter, true);
  }
  B.busy = false;
}

async function doHeal(healer, target) {
  B.busy = true;
  const s = stats(healer.u);
  face(healer, target);
  healer.pose = 'attack';
  sfx('heal', 0.7);
  B.fx.push({ kind: 'heal', x: target.x, y: target.y, t: 0, dur: 0.5 });
  await wait(250);
  const amount = Math.max(4, Math.round(s.atk * 1.1));
  heal(target, amount);
  addXp(healer, 12);
  await wait(300);
  healer.pose = null;
  B.busy = false;
}

// ------------------------------------------------------------------ Movement
async function animateMove(b, path) {
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    face(b, p);
    const fx = b.x, fy = b.y;
    b.x = p.x; b.y = p.y;
    const t0 = performance.now();
    await new Promise((res) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / 90);
        b.rx = (fx + (p.x - fx) * t) * TILE; b.ry = (fy + (p.y - fy) * t) * TILE;
        b.walk = (b.walk || 0) + 1;
        if (t < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  b.rx = b.x * TILE; b.ry = b.y * TILE; b.walk = 0;
}

// ------------------------------------------------------------------ Player input
export function battleTap(sx, sy) {
  if (!B || B.busy || B.phase !== 'player' || modalOpen()) return;
  const [tx, ty] = toWorldTile(sx, sy);
  if (!inRect(tx, ty)) { deselect(); return; }
  const who = unitAt(tx, ty);

  if (B.state === 'forecast') { // tapping the same target confirms
    if (who && who === B.fTarget) { confirmAction(); return; }
    B.state = B.sel && B.sel.moved ? 'action' : 'selected';
    B.fTarget = null; renderBattleUi();
  }

  if (B.state === 'idle' || (B.state === 'selected' && who && who.team === 'player' && who !== B.sel)) {
    if (who && who.team === 'player' && !who.acted) { select(who); return; }
    if (who) { inspect(who); return; }
    B.inspect = null; renderBattleUi(); return;
  }

  if (B.state === 'selected') {
    const s = stats(B.sel.u);
    if (who === B.sel) { deselect(); return; }
    // enemy: attack from here or auto-step into range
    if (who && who.team === 'enemy') {
      if (inRange(B.sel, who, s.range)) { showForecast(who); return; }
      const spot = bestSpotToHit(B.sel, who);
      if (spot) { moveSelected(spot.x, spot.y).then(() => { if (B && B.sel && inRange(B.sel, who, s.range)) showForecast(who); }); return; }
      inspect(who); return;
    }
    if (who && who.team === 'player' && s.heals && who !== B.sel && inRange(B.sel, who, s.range) && who.u.hp < maxHp(who.u)) { showForecast(who, true); return; }
    const n = B.reach.get(B.reach.key(tx, ty));
    if (n && !n.noStop && !(who && who !== B.sel)) { moveSelected(tx, ty); return; }
    deselect(); return;
  }

  if (B.state === 'action') {
    if (who && B.targets.includes(who)) { showForecast(who); return; }
    if (who && B.heals.includes(who)) { showForecast(who, true); return; }
    if (who) inspect(who);
  }
}

function bestSpotToHit(b, target) {
  const s = stats(b.u);
  let best = null, bd = Infinity;
  for (const n of B.reach.values()) {
    if (n.noStop || (unitAt(n.x, n.y) && unitAt(n.x, n.y) !== b)) continue;
    if (!inRange(n, target, s.range)) continue;
    const score = n.d * 10 - coverAt(n.x, n.y);
    if (score < bd) { bd = score; best = n; }
  }
  return best;
}

function select(b) {
  sfx('menu', 0.5);
  B.sel = b; B.inspect = null;
  B.state = 'selected';
  B.reach = moveReach(b);
  B.origin = { x: b.x, y: b.y };
  computeTargets();
  renderBattleUi();
}

function deselect() {
  B.sel = null; B.reach = null; B.state = 'idle'; B.targets = []; B.heals = []; B.inspect = null; B.fTarget = null;
  renderBattleUi();
}

function inspect(b) {
  B.inspect = b;
  B.inspectReach = b.team === 'enemy' ? moveReach(b) : null;
  renderBattleUi();
}

function computeTargets() {
  const b = B.sel, s = stats(b.u);
  B.targets = alive('enemy').filter((e) => inRange(b, e, s.range));
  B.heals = s.heals ? alive('player').filter((p) => p !== b && inRange(b, p, s.range) && p.u.hp < maxHp(p.u)) : [];
}

async function moveSelected(x, y) {
  const b = B.sel;
  if (x === b.x && y === b.y) { b.moved = true; B.state = 'action'; computeTargets(); renderBattleUi(); return; }
  B.busy = true;
  const path = pathFromReach(B.reach, x, y);
  sfx('step', 0.3);
  await animateMove(b, path);
  b.moved = true;
  B.busy = false;
  B.state = 'action';
  computeTargets();
  renderBattleUi();
}

function showForecast(target, isHeal = false) {
  B.state = 'forecast';
  B.fTarget = target;
  B.fHeal = isHeal;
  renderBattleUi();
}

async function confirmAction() {
  const b = B.sel, t = B.fTarget, isHeal = B.fHeal;
  if (!b || !t) return;
  B.state = 'busy'; renderBattleUi();
  if (isHeal) await doHeal(b, t); else await attack(b, t);
  finishUnit(b);
}

function finishUnit(b) {
  b.acted = true; b.moved = true;
  B.sel = null; B.reach = null; B.targets = []; B.heals = []; B.fTarget = null; B.state = 'idle';
  if (checkEnd()) return;
  renderBattleUi();
  if (alive('player').every((p) => p.acted)) setTimeout(() => endPlayerTurn(), 250);
}

function undoMove() {
  const b = B.sel;
  if (!b || !B.origin) return;
  b.x = B.origin.x; b.y = B.origin.y; b.rx = b.x * TILE; b.ry = b.y * TILE; b.moved = false;
  select(b);
}

// ------------------------------------------------------------------ Turns
async function endPlayerTurn() {
  if (!B || B.phase !== 'player') return;
  B.phase = 'enemy'; B.state = 'idle'; B.sel = null; B.reach = null; B.inspect = null;
  renderBattleUi();
  banner('Enemy turn');
  await wait(600);
  await turnStartEffects('enemy');
  for (const e of alive('enemy')) {
    if (!B || B.over) return;
    if (e.dead) continue;
    await enemyAct(e);
    if (checkEnd()) return;
  }
  if (!B || B.over) return;
  B.turn++;
  B.phase = 'player';
  for (const b of B.units) { b.acted = false; b.moved = false; }
  await turnStartEffects('player');
  if (checkEnd()) return;
  banner('Your turn');
  renderBattleUi();
}

async function turnStartEffects(team) {
  for (const b of alive(team)) {
    const s = stats(b.u);
    if (s.regen) heal(b, s.regen);
  }
  await wait(50);
}

async function enemyAct(e) {
  const s = stats(e.u);
  const reach = moveReach(e);
  const players = alive('player');
  let best = null;
  for (const n of reach.values()) {
    if (n.noStop) continue;
    const occ = unitAt(n.x, n.y);
    if (occ && occ !== e) continue;
    for (const p of players) {
      if (!inRange(n, p, s.range)) continue;
      const ghost = { ...e, x: n.x, y: n.y };
      const f = forecast(ghost, p);
      const exp = f.dmg * f.strikes * (f.hit / 100);
      let score = exp * 10 + (f.dmg * f.strikes >= p.u.hp ? 60 : 0) + (p.u.hero ? 6 : 0) - n.d * 0.5 + coverAt(n.x, n.y) * 0.2;
      if (f.counter) score -= f.counter.dmg * (f.counter.hit / 100) * 4;
      if (!best || score > best.score) best = { n, p, score };
    }
  }
  if (best) {
    const path = pathFromReach(reach, best.n.x, best.n.y);
    if (path.length > 1) await animateMove(e, path);
    await wait(120);
    B.busy = true;
    const info = forecast(e, best.p);
    await strike(e, best.p, info);
    if (!best.p.dead && !e.dead && info.counter) { await wait(120); await strike(best.p, e, info.counter, true); }
    B.busy = false;
    return;
  }
  // approach the nearest player by true path distance
  const field = new Map();
  let frontier = players.map((p) => ({ x: p.x, y: p.y }));
  frontier.forEach((p) => field.set(p.y * 1000 + p.x, 0));
  for (let d = 1; d < 40 && frontier.length; d++) {
    const next = [];
    for (const p of frontier) for (const [dx, dy] of DIRS) {
      const nx = p.x + dx, ny = p.y + dy, k = ny * 1000 + nx;
      if (field.has(k) || !terrainOk(nx, ny, s.fly)) continue;
      field.set(k, d); next.push({ x: nx, y: ny });
    }
    frontier = next;
  }
  let target = null, bd = field.get(e.y * 1000 + e.x) ?? Infinity;
  for (const n of reach.values()) {
    if (n.noStop) continue;
    const occ = unitAt(n.x, n.y); if (occ && occ !== e) continue;
    const d = field.get(n.y * 1000 + n.x) ?? Infinity;
    if (d < bd || (d === bd && target && n.d < target.d)) { bd = d; target = n; }
  }
  if (target) await animateMove(e, pathFromReach(reach, target.x, target.y));
  await wait(80);
}

function checkEnd() {
  if (!B || B.over) return true;
  const h = B.units.find((b) => b.u.hero);
  if (!h || h.dead) { B.over = true; setTimeout(() => defeat(), 900); return true; }
  if (!alive('enemy').length) { B.over = true; setTimeout(() => victory(), 700); return true; }
  return false;
}

async function retreat() {
  if (!B || B.busy || B.phase !== 'player') return;
  if (B.opts.noRetreat) { toast('No escape from here!'); return; }
  const chance = 55 + alive('player').length * 5 - alive('enemy').length * 5;
  if (rand.int(1, 100) <= chance) {
    sfx('step', 0.6);
    toast('You slip away...');
    B.over = true;
    const done = B.opts.onRetreat;
    endBattle();
    if (done) done();
  } else {
    toast('Retreat failed!');
    sfx('cancel', 0.6);
    for (const b of alive('player')) b.acted = true;
    endPlayerTurn();
  }
}

function victory() {
  sfx('victory', 0.8);
  const enemies = B.units.filter((b) => b.team === 'enemy');
  const goldBonus = Math.max(0, ...alive('player').map((b) => stats(b.u).gold));
  const gold = Math.round(enemies.reduce((s, e) => s + 4 + e.u.level * 3 + (e.u.isBandit ? 6 : 0), 0) * (1 + goldBonus) * rand.float(0.85, 1.2));
  // xp
  const results = [];
  for (const b of B.units.filter((b) => b.team === 'player' && !b.dead)) {
    const xp = (B.xp.get(b) || 0) + 10;
    const lvl = gainXp(b.u, xp);
    results.push({ u: b.u, xp, lvl });
  }
  const fallen = B.units.filter((b) => b.team === 'player' && b.dead).map((b) => b.u);
  const opts = B.opts;
  endBattle();
  if (opts.onWin) opts.onWin();
  screens.showVictory({ gold, results, fallen, tier: opts.tier || 1, elite: !!opts.elite, lootBonus: opts.lootBonus || 0, name: opts.name });
}

function defeat() {
  const fallen = B.units.filter((b) => b.team === 'player' && b.dead).map((b) => b.u);
  const name = B.name;
  endBattle(true);
  screens.showDeath({ cause: `Slain by ${name}`, fallen });
}

function endBattle(dead = false) {
  // purge the fallen from the party
  const fallen = G.party.filter((u) => !u.alive);
  for (const u of fallen) G.stats.fallen.push({ name: u.name, sprite: u.sprite, level: u.level, kills: u.kills || 0, day: Math.floor(G.steps / 40) + 1 });
  if (!dead) G.party = G.party.filter((u) => u.alive);
  for (const u of G.party) if (u.hp <= 0 && u.alive) u.hp = 1;
  B = null;
  G.battle = null;
  if (!dead) saveRun();
}

// ------------------------------------------------------------------ UI
function banner(text) { toast(text, 1000); }

export function renderBattleUi() {
  if (!B) return;
  screens.renderBattleBar({
    phase: B.phase, state: B.state, sel: B.sel, inspect: B.inspect, fTarget: B.fTarget, fHeal: B.fHeal,
    forecast: B.fTarget && !B.fHeal && B.sel ? forecast(B.sel, B.fTarget) : null,
    healAmount: B.fHeal && B.sel ? Math.max(4, Math.round(stats(B.sel.u).atk * 1.1)) : 0,
    canUndo: B.state === 'action' && B.sel && B.origin && (B.sel.x !== B.origin.x || B.sel.y !== B.origin.y),
    turn: B.turn,
    onEndTurn: () => { if (!B.busy) { for (const b of alive('player')) b.acted = true; B.sel = null; endPlayerTurn(); } },
    onWait: () => { if (B.sel && !B.busy) finishUnit(B.sel); },
    onUndo: () => undoMove(),
    onConfirm: () => confirmAction(),
    onCancel: () => { B.state = B.sel && B.sel.moved ? 'action' : 'selected'; B.fTarget = null; renderBattleUi(); },
    onRetreat: () => retreat(),
    onDeselect: () => deselect(),
  });
}

// ------------------------------------------------------------------ Update & render
export function battleUpdate(dt) {
  if (!B) return;
  time += dt;
  for (const f of B.fx) f.t += dt;
  B.fx = B.fx.filter((f) => f.t < f.dur);
  for (const t of B.texts) t.t += dt;
  B.texts = B.texts.filter((t) => t.t < 1.0);
  for (const b of B.units) {
    if (b.flash > 0) b.flash -= dt;
    if (b.lunge) b.lunge.t = Math.min(1, b.lunge.t + dt * 6);
    if (b.dead) b.fade = (b.fade || 1) - dt * 2;
  }
}

export function battleRender() {
  if (!B) return;
  const r = B.rect;
  drawGround(G.ground);
  // darken outside the arena
  const [ax, ay] = [Math.round((r.x * TILE - view.camX) * view.S), Math.round((r.y * TILE - view.camY) * view.S)];
  const aw = r.w * TILE * view.S, ah = r.h * TILE * view.S;

  // grid + overlays
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = Math.max(1, view.S / 3);
  for (let x = 0; x <= r.w; x++) { ctx.beginPath(); ctx.moveTo(ax + x * TILE * view.S, ay); ctx.lineTo(ax + x * TILE * view.S, ay + ah); ctx.stroke(); }
  for (let y = 0; y <= r.h; y++) { ctx.beginPath(); ctx.moveTo(ax, ay + y * TILE * view.S); ctx.lineTo(ax + aw, ay + y * TILE * view.S); ctx.stroke(); }

  if (B.inspect && B.inspectReach && !B.inspect.dead) {
    const s = stats(B.inspect.u);
    const danger = new Set();
    for (const n of B.inspectReach.values()) {
      if (n.noStop) continue;
      fillTile(n.x, n.y, 'rgba(255,90,80,0.18)');
      for (let dx = -s.range[1]; dx <= s.range[1]; dx++) for (let dy = -s.range[1]; dy <= s.range[1]; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d >= s.range[0] && d <= s.range[1]) danger.add((n.y + dy) * 1000 + n.x + dx);
      }
    }
    for (const k of danger) { const x = k % 1000, y = Math.floor(k / 1000); if (inRect(x, y)) strokeTile(x, y, 'rgba(255,90,80,0.45)', 1); }
  }
  if (B.sel && (B.state === 'selected') && B.reach) {
    const s = stats(B.sel.u);
    const atk = new Set();
    for (const n of B.reach.values()) {
      if (n.noStop) continue;
      fillTile(n.x, n.y, 'rgba(70,140,255,0.42)');
      strokeTile(n.x, n.y, 'rgba(160,210,255,0.5)', 0.5);
      for (let dx = -s.range[1]; dx <= s.range[1]; dx++) for (let dy = -s.range[1]; dy <= s.range[1]; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d >= s.range[0] && d <= s.range[1]) atk.add((n.y + dy) * 1000 + n.x + dx);
      }
    }
    for (const e of alive('enemy')) if (atk.has(e.y * 1000 + e.x)) fillTile(e.x, e.y, 'rgba(255,70,60,0.4)');
  }
  if (B.sel && (B.state === 'action' || B.state === 'forecast')) {
    for (const t of B.targets) fillTile(t.x, t.y, 'rgba(255,70,60,0.45)');
    for (const t of B.heals) fillTile(t.x, t.y, 'rgba(110,230,120,0.45)');
  }
  if (B.sel) strokeTile(B.sel.x, B.sel.y, `rgba(255,220,100,${0.6 + Math.sin(time * 6) * 0.3})`, 1.2);
  if (B.fTarget) strokeTile(B.fTarget.x, B.fTarget.y, '#ffffff', 1.2);

  // units + objects
  const drawables = B.units.filter((b) => !b.dead || (b.fade || 0) > 0).map((b) => ({
    z: b.ry + TILE * 2 + 0.2, // above the canopy of trees one row below
    draw: () => {
      let ox = 0, oy = 0;
      if (b.lunge) { const k = Math.sin(b.lunge.t * Math.PI) * 5; ox = b.lunge.dx * k; oy = b.lunge.dy * k; }
      const frame = b.sprite.kind === 'monster' ? Math.floor(time * 4 + b.x) % 4 : (b.walk ? Math.floor(b.walk / 6) % 4 : 0);
      drawActor(b.sprite, b.rx + ox, b.ry + oy, b.dir, frame, {
        ring: b.team === 'player' ? 'rgba(80,170,255,.45)' : 'rgba(255,70,60,.45)',
        alpha: b.dead ? Math.max(0, b.fade) : (b.acted && B.phase === 'player' && b.team === 'player' ? 0.55 : 1),
        pose: b.pose, flash: b.flash > 0,
      });
      if (!b.dead) drawHpBar(b.rx, b.ry, b.u.hp / maxHp(b.u), b.team === 'player' ? '#5fd0ff' : '#e0493f');
      if (b.u.hero && !b.dead) drawText('★', b.rx + 14, b.ry - 1, '#ffd27a', 6);
    },
  }));
  drawWorldObjects(drawables, { battle: true });

  // outside darkening on top so trees overlapping the border are dimmed too
  ctx.fillStyle = 'rgba(12,10,20,0.62)';
  ctx.fillRect(0, 0, view.w, ay);
  ctx.fillRect(0, ay + ah, view.w, view.h - ay - ah);
  ctx.fillRect(0, ay, ax, ah);
  ctx.fillRect(ax + aw, ay, view.w - ax - aw, ah);

  for (const f of B.fx) drawFx(f, f.x * TILE, f.y * TILE, f.t / f.dur);
  for (const t of B.texts) drawText(t.text, t.x, t.y - t.t * 10, t.color, t.size, Math.min(1, 2 - t.t * 2));
}

export const battleActive = () => !!B;
