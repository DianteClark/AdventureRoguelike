// Tactical grid battles fought on the overworld terrain where the encounter happened.
import { G, hero, saveRun } from './state.js';
import { TILE, MONSTERS, BANDITS, FAMILY_FX, STATUS, SKILLS, monsterOnHit, BOSSES } from './data.js';
import { OBJECTS, TERR } from './tiles.js';
import { DIRS, reachable, pathFromReach, manhattan } from './grid.js';
import {
  view, ctx, drawGround, drawActor, drawHpBar, fillTile, strokeTile, drawFx, drawText, toWorldTile, drawIcon,
} from './render.js';
import { drawWorldObjects, tileBlocked } from './world.js';
import { stats, maxHp, makeMonster, makeBandit, gainXp, makeBoss } from './units.js';
import { playMusic, sfx } from './assets.js';
import { rand } from './rng.js';
import * as screens from './screens.js';
import { toast, modalOpen } from './ui.js';
import { drawLighting, drawWeather, darkness } from './atmosphere.js';
import { shake, flash, hitstop, sparks, blood, burst, coins, healMotes, smokePuff, banner, vsIntro, dust, drawParticles, levelUpFx } from './fx.js';

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
  const foes = (opts.boss ? [makeBoss(opts.boss)] : []).concat(opts.members.map((m) => {
    if (m.type === 'bandit') return makeBandit(BANDITS.find((d) => d.sprite === m.key), m.level);
    return makeMonster(m.key, m.level);
  }));
  let et = tiles.filter((t) => dA(t) < dP(t) && units.every((pu) => manhattan(pu, t) >= 3)).sort((a, b) => dA(a) - dA(b));
  if (et.length < foes.length) et = tiles.filter((t) => units.every((pu) => manhattan(pu, t) >= 2)).sort((a, b) => dA(a) - dA(b));
  if (et.length < foes.length) et = tiles.slice().sort((a, b) => dA(a) - dA(b));
  for (const f of foes) {
    const t = take(et); if (!t) break;
    units.push(wrap(f, 'enemy', t));
  }
  if (opts.champion) {
    const c = units.find((b) => b.team === 'enemy');
    if (c) {
      c.champion = true;
      c.u.name = opts.champion;
      c.u.level += 2;
      c.u.base.hp = Math.round(c.u.base.hp * 1.7); c.u.base.atk += 2; c.u.base.def += 1;
      c.u.hp = maxHp(c.u);
    }
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
  playMusic(opts.music || (rand.chance(0.5) ? 'battle' : 'battle2'));
  screens.renderHud();
  B.busy = true;
  renderBattleUi();
  const leader = units.find((b) => b.team === 'enemy');
  const h = units.find((b) => b.u.hero) || units[0];
  sfx('impact', 0.6);
  vsIntro(h.sprite, leader ? leader.sprite : h.sprite, opts.name, opts.sub || `${foes.length} foe${foes.length > 1 ? 's' : ''}${opts.elite ? ' · Elite' : ''}`);
  setTimeout(() => { if (!B) return; B.busy = false; banner('YOUR TURN', { color: '#7fd0ff', dur: 1.0 }); sfx('menu', 0.6); renderBattleUi(); }, 1750);
}

function wrap(u, team, t) {
  return {
    u, team, x: t.x, y: t.y, rx: t.x * TILE, ry: t.y * TILE, dir: team === 'player' ? 1 : 0,
    moved: false, acted: false, lastStandUsed: false, flash: 0, pose: null, lunge: null, dead: false, st: {}, cd: 0,
    sprite: u.kind === 'boss' ? { kind: 'boss', name: u.boss } : u.kind === 'monster' ? { kind: 'monster', name: u.sprite } : { kind: 'char', name: u.sprite },
    isBoss: u.kind === 'boss',
  };
}

export function fitCamera() {
  if (!B) return;
  const portrait = window.innerHeight >= window.innerWidth;
  const hasBoss = B.units.some((b) => b.isBoss);
  const top = (hasBoss ? 118 : 64) * view.dpr, bottom = (portrait ? 150 : 80) * view.dpr;
  const availH = view.h - top - bottom, availW = view.w - 8 * view.dpr;
  view.S = Math.max(1, Math.floor(Math.min(availW / (B.rect.w * TILE), availH / (B.rect.h * TILE))));
  const pw = B.rect.w * TILE * view.S, ph = B.rect.h * TILE * view.S;
  view.camX = B.rect.x * TILE - (view.w - pw) / 2 / view.S;
  view.camY = B.rect.y * TILE - (top + (availH - ph) / 2) / view.S;
}

// ------------------------------------------------------------------ Battle-modified stats & statuses
function bstats(b) {
  const s = stats(b.u);
  const st = b.st || {};
  if (st.atkUp) s.atk += st.atkUp.val;
  if (st.defUp) s.def += st.defUp.val;
  if (st.chill) s.mov = Math.max(1, s.mov - 2);
  if (st.root) s.mov = 0;
  return s;
}
function applyStatus(b, key, turns, val = 0) {
  if (!b || b.dead) return;
  b.st = b.st || {};
  const cur = b.st[key];
  b.st[key] = { turns: Math.max(cur ? cur.turns : 0, turns), val: Math.max(cur ? cur.val : 0, val) };
  const def = STATUS[key];
  floatText(b, def.label, def.color, 6, -6);
  sfx(key === 'burn' ? 'burn' : key === 'stun' ? 'impact' : def.buff ? 'powerup' : 'strange', 0.45);
}
function decStatuses(team) {
  for (const b of alive(team)) {
    for (const k of Object.keys(b.st || {})) { b.st[k].turns--; if (b.st[k].turns <= 0) delete b.st[k]; }
  }
}
const skillOf = (b) => (b && b.u && b.u.bg && !b.u.monster ? SKILLS[b.u.bg] : null);

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
  const s = bstats(b);
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
export function forecast(att, def, opt = {}) {
  const a = bstats(att), d = bstats(def);
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
  if (opt.mult) res.dmg = Math.max(1, Math.round(res.dmg * opt.mult));
  const canCounter = !opt.noCounter && !def.dead && !(def.st && def.st.stun) && inRange(def, att, d.range);
  res.counter = canCounter ? one(d, a, def, att) : null;
  return res;
}

function dealDamage(target, dmg, source) {
  const s = bstats(target);
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
  const a = bstats(att);
  const fam = a.family;
  let fxKind = info.fxKind || (att.u.boss ? BOSSES[att.u.boss].fx : att.u.monster ? MONSTERS[att.u.monster].fx : (FAMILY_FX[fam] || 'slash'));
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
    const cx = def.x * TILE + 8, cy = def.y * TILE + 6;
    if (!hitRoll) {
      floatText(def, 'Miss', '#cfd8ff'); sfx('cancel', 0.4); dust(cx, cy + 6, '#ffffff');
      def.dodge = { t: 0, dx: def.x === att.x ? 1 : 0, dy: def.y === att.y ? 1 : 0 };
    } else {
      const crit = rand.int(1, 100) <= info.crit;
      let dmg = Math.max(1, Math.round(info.dmg * (crit ? 1.5 : 1) * rand.float(0.9, 1.1)));
      killed = dealDamage(def, dmg, att);
      def.flash = 0.25;
      def.knock = { t: 0, dx: Math.sign(def.x - att.x), dy: Math.sign(def.y - att.y) };
      sfx(crit ? 'impact' : 'hit', 0.8);
      if (crit) {
        hitstop(110); shake(5, 0.35); flash('#ffffff', 0.35, 0.15);
        sparks(cx, cy, '#ffd27a', 22);
        floatText(def, 'CRIT!', '#ffd27a', 7, -9);
      } else { shake(2, 0.18); hitstop(45); sparks(cx, cy, '#ffffff', 10); }
      if (def.u.kind === 'monster') burst(cx, cy, { n: 6, colors: [monsterBlood(def.u.monster)], speed: 60, life: 0.45, g: 240, size: 1.5 });
      else blood(cx, cy);
      floatText(def, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd27a' : '#ffffff', crit ? 12 : 9);
      if (!killed) {
        const oh = att.u.boss ? BOSSES[att.u.boss].onHit : att.u.monster ? monsterOnHit(att.u.monster) : null;
        if (oh && rand.next() < oh[1]) applyStatus(def, oh[0], oh[2]);
        if (info.status) applyStatus(def, info.status[0], info.status[1], info.status[2] || 0);
      }
      addXp(att, 6);
      if (a.lifesteal > 0) heal(att, Math.max(1, Math.round(dmg * a.lifesteal)), false);
      const ds = bstats(def);
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
  smokePuff(victim.x * TILE + 8, victim.y * TILE + 8);
  burst(victim.x * TILE + 8, victim.y * TILE + 8, { n: 16, colors: victim.team === 'enemy' ? ['#ffd27a', '#fff', '#ff9b6b'] : ['#7fd0ff', '#fff'], speed: 90, life: 0.6, g: 150, size: 1.6, glow: true });
  shake(4, 0.3);
  if (victim.u.hero) { flash('#ff2a2a', 0.45, 0.6); hitstop(300); }
  sfx('explosion', 0.35);
  if (killer && !killer.dead) {
    const ks = bstats(killer);
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
  if (got > 0) { floatText(b, `+${got}`, '#8fe07a'); if (show) healMotes(b.x * TILE + 8, b.y * TILE + 10); }
  return got;
}

function addXp(b, n) { if (b.team === 'player') B.xp.set(b, (B.xp.get(b) || 0) + n); }

function face(a, t) {
  const dx = t.x - a.x, dy = t.y - a.y;
  a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy < 0 ? 1 : 0);
}

function floatText(b, text, color, size = 8, dy = 0) {
  const stack = B.texts.filter((t) => t.ux === b.x && t.uy === b.y && t.t < 0.3).length;
  B.texts.push({ x: b.x * TILE + 8 + (Math.random() - 0.5) * 4, y: b.y * TILE - 2 + dy - stack * 7, text, color, size, t: 0, ux: b.x, uy: b.y });
}
function monsterBlood(key) {
  const m = MONSTERS[key];
  if (!m) return '#e0493f';
  if (key.startsWith('Slime')) return key === 'Slime3' ? '#9fdcff' : '#8fe07a';
  if (m.fx === 'fire') return '#ff9b3b';
  if (m.fx === 'ice' || key.includes('Blue')) return '#9fdcff';
  if (m.magic) return '#c58bff';
  return '#e0493f';
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
  const s = bstats(healer);
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

  if (B.state === 'skill') { skillTap(tx, ty); return; }

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
    const s = bstats(B.sel);
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
  const s = bstats(b);
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
  const b = B.sel, s = bstats(b);
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
  decStatuses('player');
  B.phase = 'enemy'; B.state = 'idle'; B.sel = null; B.reach = null; B.inspect = null;
  renderBattleUi();
  banner('ENEMY TURN', { color: '#ff7a6b', dur: 0.9 });
  sfx('alert', 0.4);
  await wait(800);
  await turnStartEffects('enemy');
  if (checkEnd()) return;
  for (const e of alive('enemy')) {
    if (!B || B.over) return;
    if (e.dead) continue;
    if (e.st && e.st.stun) { floatText(e, 'Stunned', '#ffe27a', 6); await wait(350); continue; }
    await enemyAct(e);
    if (checkEnd()) return;
    if (e.isBoss && !e.dead && !e.charging && !e.justReleased && B.turn % 2 === 1) bossCharge(e);
    e.justReleased = false;
  }
  if (!B || B.over) return;
  decStatuses('enemy');
  B.turn++;
  B.phase = 'player';
  for (const b of B.units) { b.acted = false; b.moved = false; }
  await turnStartEffects('player');
  if (checkEnd()) return;
  if (alive('player').every((p) => p.acted)) { setTimeout(() => endPlayerTurn(), 600); return; }
  banner('YOUR TURN', { color: '#7fd0ff', dur: 0.9 });
  sfx('menu', 0.6);
  renderBattleUi();
}

async function turnStartEffects(team) {
  for (const b of alive(team)) {
    if (b.cd > 0) b.cd--;
    const s = bstats(b);
    if (s.regen) heal(b, s.regen);
    for (const [k, dmg] of [['burn', 3], ['poison', 2]]) {
      if (b.dead || !b.st[k]) continue;
      const killed = dealDamage(b, dmg, null);
      b.flash = 0.2;
      floatText(b, `${dmg}`, STATUS[k].color, 8);
      burst(b.x * TILE + 8, b.y * TILE + 8, { n: 8, colors: [STATUS[k].color, '#fff'], speed: 40, life: 0.5, g: -40, size: 1.4 });
      sfx(k === 'burn' ? 'burn' : 'hit2', 0.4);
      await wait(220);
      if (killed) await kill(b, null);
    }
    if (!b.dead && b.st.stun && team === 'player') { b.acted = true; floatText(b, 'Stunned', '#ffe27a', 6); }
  }
  await wait(50);
}

async function enemyAct(e) {
  if (e.isBoss && await bossTurn(e)) return;
  if (await enemyTrySkill(e)) return;
  const s = bstats(e);
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
    if (await enemyTrySkill(e)) return;
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
  if (!h || h.dead) {
    B.over = true;
    setTimeout(() => { banner('DEFEAT', { color: '#ff4a4a', sub: 'The road ends here', dur: 2.2, size: 1.2 }); sfx('gameover', 0.7); }, 500);
    setTimeout(() => defeat(), 2600); return true;
  }
  if (!alive('enemy').length) {
    B.over = true;
    setTimeout(() => {
      banner('VICTORY!', { color: '#ffd27a', dur: 1.6, size: 1.2 });
      sfx('victory', 0.8);
      for (const p of alive('player')) { coins(p.x * TILE + 8, p.y * TILE + 4, 10); p.cheer = 1.4; }
    }, 350);
    setTimeout(() => victory(), 1900); return true;
  }
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
  const enemies = B.units.filter((b) => b.team === 'enemy');
  const goldBonus = Math.max(0, ...alive('player').map((b) => bstats(b).gold));
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

export function renderBattleUi() {
  if (!B) return;
  screens.renderBattleBar({
    phase: B.phase, state: B.state, sel: B.sel, inspect: B.inspect, fTarget: B.fTarget, fHeal: B.fHeal,
    forecast: B.fTarget && !B.fHeal && B.sel ? forecast(B.sel, B.fTarget) : null,
    healAmount: B.fHeal && B.sel ? Math.max(4, Math.round(bstats(B.sel).atk * 1.1)) : 0,
    canUndo: B.state === 'action' && B.sel && B.origin && (B.sel.x !== B.origin.x || B.sel.y !== B.origin.y),
    turn: B.turn,
    noRetreat: !!B.opts.noRetreat,
    skill: B.sel && B.sel.team === 'player' ? skillOf(B.sel) : null,
    skillCd: B.sel ? B.sel.cd : 0,
    onSkill: () => beginSkill(),
    onEndTurn: () => { if (!B.busy) { for (const b of alive('player')) b.acted = true; B.sel = null; endPlayerTurn(); } },
    onWait: () => { if (B.sel && !B.busy) finishUnit(B.sel); },
    onUndo: () => undoMove(),
    onConfirm: () => confirmAction(),
    onCancel: () => { B.state = B.sel && B.sel.moved ? 'action' : 'selected'; B.fTarget = null; B.skillTiles = null; B.skillHover = null; renderBattleUi(); },
    onRetreat: () => retreat(),
    onDeselect: () => deselect(),
  });
}

// ------------------------------------------------------------------ Update & render
let bdt = 0.016;
export function battleUpdate(dt) {
  if (!B) return;
  time += dt; bdt = dt;
  for (const f of B.fx) f.t += dt;
  B.fx = B.fx.filter((f) => f.t < f.dur);
  for (const t of B.texts) t.t += dt;
  B.texts = B.texts.filter((t) => t.t < 1.0);
  for (const b of B.units) {
    if (b.flash > 0) b.flash -= dt;
    if (b.lunge) b.lunge.t = Math.min(1, b.lunge.t + dt * 6);
    if (b.knock) { b.knock.t += dt * 7; if (b.knock.t >= 1) b.knock = null; }
    if (b.dodge) { b.dodge.t += dt * 5; if (b.dodge.t >= 1) b.dodge = null; }
    if (b.cheer > 0) b.cheer -= dt;
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
    const s = bstats(B.inspect);
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
    const s = bstats(B.sel);
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
  if (B.state === 'skill' && B.skillTiles) {
    for (const t of B.skillTiles) { fillTile(t.x, t.y, `rgba(190,100,255,${0.42 + Math.sin(time * 6) * 0.1})`); strokeTile(t.x, t.y, 'rgba(230,190,255,0.7)', 0.6); }
    if (B.skillHover) for (const t of B.skillHover) strokeTile(t.x, t.y, '#ffd27a', 1);
  }
  for (const bb of B.units) {
    if (!bb.isBoss || bb.dead || !bb.charging) continue;
    for (const t of bb.danger) { fillTile(t.x, t.y, `rgba(255,40,40,${0.25 + Math.sin(time * 8) * 0.12})`); strokeTile(t.x, t.y, 'rgba(255,120,100,0.8)', 0.6); }
  }
  if (B.sel) strokeTile(B.sel.x, B.sel.y, `rgba(255,220,100,${0.6 + Math.sin(time * 6) * 0.3})`, 1.2);
  if (B.fTarget) strokeTile(B.fTarget.x, B.fTarget.y, '#ffffff', 1.2);

  // units + objects
  const drawables = B.units.filter((b) => !b.dead || (b.fade || 0) > 0).map((b) => ({
    z: b.ry + TILE * 2 + 0.2, // above the canopy of trees one row below
    draw: () => {
      let ox = 0, oy = 0;
      if (b.lunge) { const k = Math.sin(b.lunge.t * Math.PI) * 6; ox = b.lunge.dx * k; oy = b.lunge.dy * k; }
      if (b.knock) { const k = Math.sin(b.knock.t * Math.PI) * 3; ox += b.knock.dx * k; oy += b.knock.dy * k; }
      if (b.dodge) { const k = Math.sin(b.dodge.t * Math.PI) * 5; ox += b.dodge.dx * k; oy += b.dodge.dy * k; }
      if (b.cheer > 0) oy -= Math.abs(Math.sin(b.cheer * 9)) * 4;
      const breathe = b.sprite.kind !== 'monster' && !b.walk && Math.floor(time * 1.6 + b.x * 0.7) % 2 === 0 ? 0.5 : 0;
      oy += breathe;
      const frame = b.sprite.kind === 'monster' ? Math.floor(time * 4 + b.x) % 4 : (b.walk ? Math.floor(b.walk / 6) % 4 : 0);
      drawActor(b.sprite, b.rx + ox, b.ry + oy, b.dir, frame, {
        ring: b.team === 'player' ? 'rgba(80,170,255,.45)' : b.champion ? `rgba(255,200,60,${0.5 + Math.sin(time * 5) * 0.2})` : 'rgba(255,70,60,.45)',
        alpha: b.alpha === 0 ? 0 : b.dead ? Math.max(0, b.fade) : (b.acted && B.phase === 'player' && b.team === 'player' ? 0.55 : 1),
        pose: b.pose, flash: b.flash > 0,
      });
      if (!b.dead) drawHpBar(b.rx, b.ry, b.u.hp / maxHp(b.u), b.team === 'player' ? '#5fd0ff' : '#e0493f');
      if (b.u.hero && !b.dead) drawText('★', b.rx + 14, b.ry - 1, '#ffd27a', 6);
      if (b.champion && !b.dead) drawText('♛', b.rx + 8, b.ry - 5, '#ffd23d', 7);
      if (!b.dead) {
        let i = 0;
        for (const k of Object.keys(b.st || {})) { drawIcon(STATUS[k].icon, b.rx - 2 + i * 6, b.ry + 9, 6); i++; }
      }
      if (!b.dead && b.team === 'player' && B.phase === 'player' && !b.acted && B.sel !== b && !B.busy) {
        const bob = Math.sin(time * 5 + b.x) * 1.2;
        drawChevron(b.rx + 8, b.ry - 7 + bob, 'rgba(127,208,255,0.9)');
      }
      if (B.sel === b) drawChevron(b.rx + 8, b.ry - 9 + Math.sin(time * 8) * 2, '#ffd27a', 1.4);
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
  drawParticles();
  const dk = darkness() * 0.8;
  if (dk > 0.01) {
    const lights = B.units.filter((b) => !b.dead).map((b) => ({
      x: b.rx + 8, y: b.ry + 8, r: b.team === 'player' ? 44 : 26,
      color: b.team === 'player' ? 'rgba(255,200,120,0.3)' : (b.u.monster && ['fire', 'magic'].includes(MONSTERS[b.u.monster].fx) ? 'rgba(255,120,60,0.5)' : null),
      flicker: true,
    }));
    for (const f of B.fx) lights.push({ x: f.x * TILE + 8, y: f.y * TILE + 8, r: 40, color: 'rgba(255,220,160,0.5)' });
    drawLighting(lights, dk);
  }
  drawWeather(bdt);
  for (const t of B.texts) {
    const pop = 1 + Math.max(0, 0.15 - t.t) * 5;
    const rise = (1 - Math.pow(1 - Math.min(1, t.t * 1.6), 3)) * 12;
    drawText(t.text, t.x, t.y - rise, t.color, t.size * pop, Math.min(1, 2.2 - t.t * 2.2));
  }
  drawBossBar();
  // danger vignette when the leader is low
  const hb = B.units.find((b) => b.u.hero && !b.dead);
  if (hb && hb.u.hp / maxHp(hb.u) < 0.3) {
    const g = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(200,0,0,${0.25 + Math.sin(time * 4) * 0.08})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
  }
}

function drawChevron(wx, wy, color, scale = 1) {
  const S = view.S;
  const x = Math.round((wx - view.camX) * S), y = Math.round((wy - view.camY) * S);
  const w = 3 * S * scale, h = 2.5 * S * scale;
  ctx.fillStyle = '#140c10';
  ctx.beginPath(); ctx.moveTo(x - w - S, y - S); ctx.lineTo(x + w + S, y - S); ctx.lineTo(x, y + h + S); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
}

export const battleActive = () => !!B;


// ------------------------------------------------------------------ Skills
const plus = (x, y) => [{ x, y }, { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];
function freeAdjacent(t, from) {
  const opts = [];
  for (const [dx, dy] of DIRS) {
    const x = t.x + dx, y = t.y + dy;
    if (!terrainOk(x, y, false) || unitAt(x, y)) continue;
    opts.push({ x, y, d: from ? -manhattan({ x, y }, from) : 0 });
  }
  opts.sort((a, b) => a.d - b.d); // prefer the far side (behind the target)
  return opts[0] || null;
}

function skillTargets(b, sk) {
  if (sk.target === 'enemy') {
    return alive('enemy').filter((e) => inRange(b, e, sk.range) && (sk.id !== 'shadowstep' || freeAdjacent(e, b))).map((e) => ({ x: e.x, y: e.y }));
  }
  if (sk.target === 'tile') {
    const out = [];
    for (let y = B.rect.y; y < B.rect.y + B.rect.h; y++) for (let x = B.rect.x; x < B.rect.x + B.rect.w; x++) if (inRange(b, { x, y }, sk.range)) out.push({ x, y });
    return out;
  }
  return [];
}

function beginSkill() {
  const b = B.sel, sk = skillOf(b);
  if (!b || !sk || b.cd > 0 || B.busy) return;
  if (sk.target === 'self') { executeSkill(b, sk, null); return; }
  const tiles = skillTargets(b, sk);
  if (!tiles.length) { toast('No targets in range'); return; }
  B.prevState = B.state;
  B.state = 'skill';
  B.skillTiles = tiles;
  B.skillHover = null;
  renderBattleUi();
}

function skillTap(tx, ty) {
  const b = B.sel, sk = skillOf(b);
  const ok = B.skillTiles && B.skillTiles.some((t) => t.x === tx && t.y === ty);
  if (!ok) { B.state = B.prevState || 'selected'; B.skillTiles = null; renderBattleUi(); return; }
  if (sk.id === 'fireball') {
    const area = plus(tx, ty);
    if (!B.skillHover || B.skillHover[0].x !== tx || B.skillHover[0].y !== ty) { B.skillHover = area; return; } // first tap previews
  }
  executeSkill(b, sk, { x: tx, y: ty });
}

async function executeSkill(b, sk, target) {
  B.state = 'busy'; B.busy = true; B.skillTiles = null; B.skillHover = null;
  renderBattleUi();
  banner(sk.name, { color: '#e0b0ff', dur: 0.8, size: 0.55 });
  sfx('powerup', 0.6);
  b.cd = sk.cd + 1; // ticks down at the start of our next turn
  b.pose = 'attack';
  await wait(300);
  const t = target ? unitAt(target.x, target.y) : null;
  const s = bstats(b);
  switch (sk.id) {
    case 'iaido': {
      flash('#ffffff', 0.25, 0.12);
      const info = forecast(b, t, { mult: 1.7, noCounter: true }); info.fxKind = 'heavy'; info.crit = Math.min(80, info.crit + 15);
      await strike(b, t, info, true);
      break;
    }
    case 'pin': {
      const info = forecast(b, t, { noCounter: true }); info.fxKind = 'cut'; info.status = ['root', 1];
      await strike(b, t, info, true);
      break;
    }
    case 'quake': {
      sfx('slam', 0.8); shake(7, 0.5); hitstop(80);
      B.fx.push({ kind: 'quake', x: b.x, y: b.y - 0.5, t: 0, dur: 0.7 });
      for (const [dx, dy] of DIRS) dustRing(b.x + dx, b.y + dy);
      await wait(250);
      for (const [dx, dy] of DIRS) {
        const e = unitAt(b.x + dx, b.y + dy);
        if (!e || e.team === b.team) continue;
        const f = forecast(b, e, { noCounter: true });
        const dmg = Math.max(1, Math.round(f.dmg * rand.float(0.9, 1.1)));
        const killed = dealDamage(e, dmg, b);
        e.flash = 0.3; e.knock = { t: 0, dx, dy };
        floatText(e, `${dmg}`, '#ffffff', 9);
        sparks(e.x * TILE + 8, e.y * TILE + 8, '#ffb45a', 12);
        addXp(b, 6);
        if (killed) await kill(e, b);
        else if (rand.chance(0.5)) applyStatus(e, 'stun', 1);
      }
      break;
    }
    case 'bulwark': {
      applyStatus(b, 'defUp', 2, 4);
      B.fx.push({ kind: 'shield', x: b.x, y: b.y, t: 0, dur: 0.6 });
      for (const [dx, dy] of DIRS) {
        const a = unitAt(b.x + dx, b.y + dy);
        if (a && a.team === b.team) { applyStatus(a, 'defUp', 2, 2); B.fx.push({ kind: 'shield', x: a.x, y: a.y, t: 0, dur: 0.6 }); }
      }
      await wait(500);
      break;
    }
    case 'shadowstep': {
      const spot = freeAdjacent(t, b);
      if (spot) {
        smokePuff(b.x * TILE + 8, b.y * TILE + 8, '#5a4a6a', 14);
        sfx('fx', 0.6);
        b.alpha = 0;
        await wait(180);
        b.x = spot.x; b.y = spot.y; b.rx = b.x * TILE; b.ry = b.y * TILE;
        smokePuff(b.x * TILE + 8, b.y * TILE + 8, '#5a4a6a', 14);
        b.alpha = 1;
        await wait(120);
        const info = forecast(b, t, { noCounter: true }); info.crit = Math.min(80, info.crit + 20);
        await strike(b, t, info, true);
      }
      break;
    }
    case 'fireball': {
      const area = plus(target.x, target.y).filter((p) => inRect(p.x, p.y));
      sfx('fire', 0.8);
      B.fx.push({ kind: 'boom', x: target.x, y: target.y, t: 0, dur: 0.6 });
      for (const p of area.slice(1)) B.fx.push({ kind: 'fire', x: p.x, y: p.y, t: 0, dur: 0.5 });
      shake(6, 0.4); flash('#ff9b3b', 0.25, 0.2);
      burst(target.x * TILE + 8, target.y * TILE + 8, { n: 30, colors: ['#ff9b3b', '#ffd27a', '#ff5a3a'], speed: 120, life: 0.6, g: 60, size: 1.8, glow: true });
      await wait(250);
      for (const p of area) {
        const e = unitAt(p.x, p.y);
        if (!e || e.team === b.team) continue;
        const es = bstats(e);
        const dmg = Math.max(1, Math.round((s.atk - Math.floor(es.def / 2)) * 0.9 * rand.float(0.9, 1.1)));
        const killed = dealDamage(e, dmg, b);
        e.flash = 0.3;
        floatText(e, `${dmg}`, '#ffb45a', 9);
        addXp(b, 6);
        if (killed) await kill(e, b);
        else if (rand.chance(0.6)) applyStatus(e, 'burn', 2);
      }
      break;
    }
    case 'sanctuary': {
      sfx('heal', 0.8);
      const amount = Math.max(5, Math.round(s.atk * 0.8));
      for (const a of alive(b.team)) {
        if (manhattan(a, b) > 2) continue;
        B.fx.push({ kind: 'heal', x: a.x, y: a.y, t: 0, dur: 0.6 });
        for (const k of ['burn', 'poison', 'chill', 'root', 'stun']) if (a.st[k]) delete a.st[k];
        heal(a, amount);
        addXp(b, 4);
      }
      await wait(500);
      break;
    }
    case 'rally': {
      sfx('levelup', 0.6);
      for (const a of alive(b.team)) {
        if (manhattan(a, b) > 3) continue;
        applyStatus(a, 'atkUp', 2, 3);
        B.fx.push({ kind: 'boost', x: a.x, y: a.y - 0.3, t: 0, dur: 0.7 });
        a.cheer = 0.6;
      }
      await wait(500);
      break;
    }
  }
  b.pose = null;
  B.busy = false;
  if (checkEnd()) return;
  if (b.team === 'player') finishUnit(b);
}

function dustRing(x, y) {
  if (!inRect(x, y)) return;
  smokePuff(x * TILE + 8, y * TILE + 12, '#bba58a', 6);
}

// enemy humans use their skills when it makes sense; returns true if a skill was used
async function enemyTrySkill(e) {
  const sk = skillOf(e);
  if (!sk || e.cd > 0) return false;
  const players = alive('player');
  if (sk.id === 'quake') {
    const n = DIRS.filter(([dx, dy]) => { const p = unitAt(e.x + dx, e.y + dy); return p && p.team === 'player'; }).length;
    if (n >= 2) { await executeSkill(e, sk, null); return true; }
  }
  if (sk.id === 'fireball') {
    let best = null, bn = 1;
    for (const p of players) for (const c of plus(p.x, p.y)) {
      if (!inRange(e, c, sk.range)) continue;
      const n = plus(c.x, c.y).filter((q) => { const u = unitAt(q.x, q.y); return u && u.team === 'player'; }).length;
      if (n > bn) { bn = n; best = c; }
    }
    if (best) { await executeSkill(e, sk, best); return true; }
  }
  if (sk.id === 'iaido' || sk.id === 'pin') {
    const t = players.filter((p) => inRange(e, p, sk.range)).sort((a, b) => a.u.hp - b.u.hp)[0];
    if (t) { await executeSkill(e, sk, { x: t.x, y: t.y }); return true; }
  }
  if (sk.id === 'rally' && alive('enemy').filter((a) => manhattan(a, e) <= 3).length >= 3) { await executeSkill(e, sk, null); return true; }
  if (sk.id === 'sanctuary' && alive('enemy').some((a) => manhattan(a, e) <= 2 && a.u.hp < maxHp(a.u) * 0.6)) { await executeSkill(e, sk, null); return true; }
  return false;
}


// ------------------------------------------------------------------ Bosses
const SPECIAL = {
  quake:    { name: 'Earthbreaker', radius: 2, mult: 0.8, status: ['stun', 0.4, 1], fx: 'quake', color: '#ffb45a', sfx: 'slam' },
  blizzard: { name: 'White Death', radius: 3, mult: 0.6, magic: true, status: ['chill', 0.9, 2], fx: 'ice', color: '#9fdcff', sfx: 'magic2' },
  inferno:  { name: 'Inferno', radius: 2, mult: 0.75, magic: true, status: ['burn', 0.8, 2], fx: 'fire', color: '#ff9b3b', sfx: 'fire' },
  storm:    { name: 'Thunder Judgment', targets: 3, mult: 0.9, magic: true, status: ['stun', 0.3, 1], fx: 'thunder', color: '#ffe27a', sfx: 'explosion' },
};

function bossCharge(e) {
  const d = BOSSES[e.u.boss], sp = SPECIAL[d.special];
  e.charging = true;
  if (sp.targets) {
    e.danger = alive('player').sort(() => Math.random() - 0.5).slice(0, sp.targets).map((p) => ({ x: p.x, y: p.y }));
  } else {
    e.danger = [];
    for (let y = B.rect.y; y < B.rect.y + B.rect.h; y++) for (let x = B.rect.x; x < B.rect.x + B.rect.w; x++) {
      const dd = manhattan({ x, y }, e);
      if (dd >= 1 && dd <= sp.radius) e.danger.push({ x, y });
    }
  }
  banner(`${d.short} gathers power...`, { color: sp.color, sub: `${sp.name} next turn — get out of the red!`, dur: 1.6, size: 0.6 });
  sfx('strange', 0.6);
}

async function bossTurn(e) {
  const d = BOSSES[e.u.boss], sp = SPECIAL[d.special];
  const frac = e.u.hp / maxHp(e.u);
  if (!e.summoned && frac < 0.55) {
    e.summoned = true;
    banner('REINFORCEMENTS', { color: '#ff7a6b', sub: `${d.short} calls for aid`, dur: 1.3, size: 0.7 });
    sfx('alert', 0.7);
    const spots = [...reachable(e.x, e.y, 4, (x, y) => terrainOk(x, y, false)).values()].filter((n) => n.d > 0 && !unitAt(n.x, n.y));
    for (let i = 0; i < 2 && spots.length; i++) {
      const t = spots.splice(Math.floor(Math.random() * Math.min(6, spots.length)), 1)[0];
      const m = makeMonster(rand.pick(d.minions), Math.max(1, d.level - 3));
      const w = wrap(m, 'enemy', t);
      w.acted = true;
      B.units.push(w);
      smokePuff(t.x * TILE + 8, t.y * TILE + 8, '#a080c0', 12);
    }
    await wait(700);
  }
  if (!e.enraged && frac < 0.3) {
    e.enraged = true;
    applyStatus(e, 'atkUp', 99, 4);
    banner('ENRAGED!', { color: '#ff3a3a', sub: `${d.short} fights with fury`, dur: 1.3, size: 0.8 });
    flash('#ff2a2a', 0.35, 0.3); shake(5, 0.4);
    await wait(600);
  }
  if (!e.charging) return false;
  // release the special
  e.charging = false; e.justReleased = true;
  const zone = e.danger || [];
  e.danger = [];
  banner(sp.name.toUpperCase(), { color: sp.color, dur: 1.0, size: 0.8 });
  sfx(sp.sfx, 0.9); shake(8, 0.6); flash(sp.color, 0.3, 0.25); hitstop(120);
  if (d.special === 'quake') B.fx.push({ kind: 'quake', x: e.x, y: e.y - 0.5, t: 0, dur: 0.7 });
  for (const t of zone) if (Math.random() < 0.45 || unitAt(t.x, t.y)) B.fx.push({ kind: sp.fx, x: t.x, y: t.y, t: 0, dur: 0.6 });
  await wait(350);
  for (const t of zone) {
    const p = unitAt(t.x, t.y);
    if (!p || p.team !== 'player') continue;
    const ps = bstats(p), es = bstats(e);
    const def = sp.magic ? Math.floor(ps.def / 2) : ps.def;
    const dmg = Math.max(1, Math.round((es.atk - def) * sp.mult * rand.float(0.9, 1.1)));
    const killed = dealDamage(p, dmg, e);
    p.flash = 0.3;
    floatText(p, `${dmg}`, sp.color, 10);
    burst(p.x * TILE + 8, p.y * TILE + 8, { n: 14, colors: [sp.color, '#fff'], speed: 90, life: 0.5, g: 120, size: 1.6, glow: true });
    if (killed) await kill(p, e);
    else if (rand.next() < sp.status[1]) applyStatus(p, sp.status[0], sp.status[2]);
  }
  await wait(500);
  return true;
}

function drawBossBar() {
  const bb = B.units.find((b) => b.isBoss && !b.dead);
  if (!bb) return;
  const d = view.dpr, W = view.w;
  const w = Math.min(W - 24 * d, 520 * d), x = (W - w) / 2, y = 92 * d, h = 12 * d;
  const frac = bb.u.hp / maxHp(bb.u);
  bb.barShown = bb.barShown == null ? frac : bb.barShown + (frac - bb.barShown) * 0.08;
  ctx.fillStyle = 'rgba(14,10,22,0.85)';
  ctx.fillRect(x - 4 * d, y - 18 * d, w + 8 * d, h + 24 * d);
  ctx.font = `${Math.round(13 * d)}px Ninja, monospace`;
  ctx.textAlign = 'left'; ctx.fillStyle = bb.enraged ? '#ff5a4a' : '#ffd27a';
  ctx.fillText(bb.u.name + (bb.charging ? '  ⚠ charging' : ''), x, y - 4 * d);
  ctx.fillStyle = '#2a1414'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f0e0b0'; ctx.fillRect(x, y, w * Math.max(0, bb.barShown), h);
  ctx.fillStyle = bb.enraged ? '#ff3a3a' : '#d8324a'; ctx.fillRect(x, y, w * frac, h);
  ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = d; ctx.strokeRect(x, y, w, h);
}
