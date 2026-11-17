// Boot, main loop, input routing, run lifecycle.
import { G, saveRun, hasSave } from './state.js';
import { preload, unlockAudio, playMusic } from './assets.js';
import { SHEETS } from './tiles.js';
import { generateWorld } from './worldgen.js';
import { resize, view, buildGround, drawGround, ctx } from './render.js';
import { enterWorld, worldUpdate, worldRender, worldTap, worldKey, computeFootprints, tileBlocked, drawWorldObjects, stopWalking, debugTeleport } from './world.js';
import { startBattle, battleUpdate, battleRender, battleTap, fitCamera, battleActive, renderBattleUi } from './battle.js';
import * as screens from './screens.js';
import { makeHero, makeConsumable } from './units.js';
import { modalOpen } from './ui.js';
import { TILE } from './data.js';

screens.bindApi({
  newRun, resumeRun, returnToWorld, toTitle, startBattle, tileBlocked,
  refreshWorld: () => computeFootprints(),
  resumeWorldMusic: () => { if (G.scene === 'world') playMusic('world'); },
});

function newRun(bgKey, sprite, name) {
  const seed = (Math.random() * 2 ** 31) >>> 0;
  G.world = generateWorld(seed);
  G.ground = buildGround(G.world);
  const h = makeHero(bgKey, sprite, name);
  G.party = [h];
  G.bag = [makeConsumable('potion')];
  G.gold = 50;
  G.steps = 0;
  G.flags = {};
  G.stats = { battles: 0, kills: 0, villages: 0, chests: 0, events: 0, fallen: [] };
  G.runId = seed.toString(36);
  G.player = { x: G.world.start.x, y: G.world.start.y, rx: G.world.start.x * TILE, ry: G.world.start.y * TILE, dir: 0, moving: 0 };
  enterWorld();
  saveRun();
  let seen = false;
  try { seen = !!localStorage.getItem('ar_help_seen'); localStorage.setItem('ar_help_seen', '1'); } catch (e) {}
  if (!seen) screens.showHelp();
}

function resumeRun() {
  G.ground = buildGround(G.world);
  enterWorld();
}

function returnToWorld() {
  stopWalking();
  enterWorld();
}

function toTitle() {
  G.scene = 'title';
  setupTitleWorld();
  screens.showTitle();
}

// A drifting world behind the title screen
let titleT = 0;
function setupTitleWorld() {
  G.world = generateWorld((Math.random() * 2 ** 31) >>> 0);
  G.ground = buildGround(G.world);
  view.S = Math.max(2, Math.round(3 * view.dpr));
}

// ------------------------------------------------------------------ Loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.imageSmoothingEnabled = false;
  if (G.scene === 'world') { worldUpdate(dt); worldRender(); }
  else if (G.scene === 'battle') { battleUpdate(dt); battleRender(); }
  else if (G.ground && G.world) {
    titleT += dt;
    view.camX = G.world.W * TILE / 2 - view.w / view.S / 2 + Math.sin(titleT * 0.05) * 200;
    view.camY = G.world.H * TILE / 2 - view.h / view.S / 2 + Math.cos(titleT * 0.04) * 160;
    drawGround(G.ground);
    drawWorldObjects([], { battle: true });
  } else { ctx.fillStyle = '#1b1a24'; ctx.fillRect(0, 0, view.w, view.h); }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ Input
const canvas = document.getElementById('game');
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 14) return;
  const sx = e.clientX * view.dpr, sy = e.clientY * view.dpr;
  if (G.scene === 'world') worldTap(sx, sy);
  else if (G.scene === 'battle') battleTap(sx, sy);
});
document.addEventListener('pointerdown', () => unlockAudio(), { once: true });

const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (G.scene === 'world' && KEYS[e.key]) { e.preventDefault(); worldKey(...KEYS[e.key]); }
});

window.addEventListener('resize', () => {
  resize();
  if (G.scene === 'battle') fitCamera();
  else if (G.scene === 'world') { enterWorld(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.scene === 'world') saveRun(); });

// ------------------------------------------------------------------ Boot
async function boot() {
  resize();
  await Promise.all([
    preload(Object.values(SHEETS).concat(['Actor/Character/Shadow.png', 'Items/Treasure/LittleTreasureChest.png'])),
    document.fonts && document.fonts.load ? document.fonts.load('16px Ninja').catch(() => {}) : Promise.resolve(),
  ]);
  document.getElementById('loading').remove();
  toTitle();
  requestAnimationFrame(frame);
}
boot();

// debug handle
window.__G = G;
window.__dbg = {
  startBattle, newRun, screens, debugTeleport,
  tileCss: (x, y) => [((x * TILE + 8 - view.camX) * view.S) / view.dpr, ((y * TILE + 8 - view.camY) * view.S) / view.dpr],
};
