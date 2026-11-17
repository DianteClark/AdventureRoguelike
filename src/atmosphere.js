// Day/night lighting, weather, biome moods, and the minimap.
import { G } from './state.js';
import { view, ctx } from './render.js';
import { TILE } from './data.js';
import { TERR, OBJECTS, BIOME } from './tiles.js';
import { rand } from './rng.js';
import { playAmbient } from './assets.js';

export const DAY_LEN = 40;

// ------------------------------------------------------------------ Time of day
export function timeOfDay() { return (G.steps % DAY_LEN) / DAY_LEN; }
export function phase() {
  const t = timeOfDay();
  if (t < 0.08) return 'dawn';
  if (t < 0.55) return 'day';
  if (t < 0.68) return 'dusk';
  return 'night';
}
export const isNight = () => phase() === 'night';
// 0 = full day, 1 = full night (smooth)
export function darkness() {
  const t = timeOfDay();
  if (t < 0.08) return 0.7 * (1 - t / 0.08);
  if (t < 0.55) return 0;
  if (t < 0.68) return 0.7 * ((t - 0.55) / 0.13);
  return 0.7;
}
export function phaseLabel() { return { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' }[phase()]; }

// ------------------------------------------------------------------ Lighting
const light = document.createElement('canvas');
const lctx = light.getContext('2d');

// lights: [{x,y (world px), r (px), color}]
export function drawLighting(lights, strength = darkness()) {
  const tint = warmTint();
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, view.w, view.h); }
  if (strength <= 0.01) return;
  if (light.width !== view.w || light.height !== view.h) { light.width = view.w; light.height = view.h; }
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, view.w, view.h);
  lctx.fillStyle = `rgba(8,10,38,${strength})`;
  lctx.fillRect(0, 0, view.w, view.h);
  lctx.globalCompositeOperation = 'destination-out';
  const S = view.S;
  for (const l of lights) {
    const x = (l.x - view.camX) * S, y = (l.y - view.camY) * S, r = l.r * S;
    if (x < -r || y < -r || x > view.w + r || y > view.h + r) continue;
    const flick = l.flicker ? 1 + Math.sin(performance.now() / 90 + l.x) * 0.04 : 1;
    const g = lctx.createRadialGradient(x, y, 0, x, y, r * flick);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(x, y, r * flick, 0, Math.PI * 2); lctx.fill();
  }
  ctx.drawImage(light, 0, 0);
  // warm glows on top
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    if (!l.color) continue;
    const x = (l.x - view.camX) * S, y = (l.y - view.camY) * S, r = l.r * S * 0.6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, l.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = strength * 0.6;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function warmTint() {
  const t = timeOfDay();
  if (t >= 0.5 && t < 0.7) { const k = 1 - Math.abs(t - 0.6) / 0.1; return `rgba(255,120,40,${Math.max(0, k) * 0.16})`; }
  if (t < 0.12) { const k = 1 - Math.abs(t - 0.05) / 0.07; return `rgba(255,170,120,${Math.max(0, k) * 0.12})`; }
  return null;
}

export function worldLights() {
  const L = [{ x: G.player.rx + 8, y: G.player.ry + 8, r: 72, color: 'rgba(255,200,120,0.35)', flicker: true }];
  for (const p of G.world.pois) {
    if (p.gone) continue;
    if (p.type === 'village') L.push({ x: p.x * TILE + 8, y: p.y * TILE, r: 64, color: 'rgba(255,170,70,0.6)', flicker: true });
    else if (p.type === 'shrine' && !p.used) L.push({ x: p.x * TILE + 8, y: p.y * TILE, r: 34, color: 'rgba(140,200,255,0.5)' });
    else if (p.type === 'boss' && !p.cleared) L.push({ x: p.x * TILE + 8, y: p.y * TILE, r: 48, color: 'rgba(255,60,60,0.55)', flicker: true });
  }
  return L;
}

// ------------------------------------------------------------------ Weather
const WEATHER_TABLE = [
  [['clear', 5], ['rain', 2.5], ['leaves', 1.5], ['storm', 0.6]],     // grass
  [['clear', 4], ['dust', 4], ['heat', 1]],                             // sand
  [['snow', 6], ['clear', 2], ['blizzard', 1]],                         // snow
];
export const WEATHER_NAME = { clear: 'Clear', rain: 'Rain', storm: 'Storm', leaves: 'Breezy', dust: 'Sandstorm', heat: 'Heatwave', snow: 'Snowfall', blizzard: 'Blizzard' };

export function currentBiome() { return G.world.biome[G.player.y * G.world.W + G.player.x]; }

export function updateWeather(force = false) {
  const f = G.flags;
  const b = currentBiome();
  if (force || !f.weather || G.steps >= f.weather.until || f.weather.biome !== b) {
    const kind = rand.weighted(WEATHER_TABLE[b]);
    f.weather = { kind, biome: b, until: G.steps + rand.int(25, 60) };
  }
  const k = f.weather.kind;
  playAmbient(k === 'rain' || k === 'storm' ? 'amb_rain' : k === 'blizzard' || k === 'dust' ? 'amb_wind' : k === 'snow' ? 'amb_wind2' : null, k === 'snow' ? 0.15 : 0.3);
  return f.weather;
}
export const weatherKind = () => (G.flags && G.flags.weather ? G.flags.weather.kind : 'clear');

// screen-space weather particles
const drops = [];
let lightning = 0;
export function drawWeather(dt, kind = weatherKind()) {
  const W = view.w, H = view.h, d = view.dpr;
  const spec = {
    rain: { n: 140, color: 'rgba(170,200,255,0.55)', vx: -120, vy: 900, len: 14 },
    storm: { n: 260, color: 'rgba(170,200,255,0.65)', vx: -260, vy: 1100, len: 18 },
    snow: { n: 120, color: 'rgba(255,255,255,0.9)', vx: -20, vy: 60, size: 2.2, wob: 30 },
    blizzard: { n: 300, color: 'rgba(255,255,255,0.85)', vx: -360, vy: 140, size: 2, wob: 20 },
    dust: { n: 130, color: 'rgba(240,180,110,0.5)', vx: -380, vy: 30, size: 1.8, wob: 25 },
    heat: { n: 30, color: 'rgba(255,230,180,0.25)', vx: 0, vy: -20, size: 2.5, wob: 15 },
    leaves: { n: 24, color: '#9bd164', vx: -90, vy: 50, size: 3, wob: 40, leaf: true },
  }[kind];
  if (!spec) { drops.length = 0; return; }
  while (drops.length < spec.n) drops.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.8, ph: Math.random() * 6 });
  if (drops.length > spec.n) drops.length = spec.n;
  ctx.fillStyle = spec.color; ctx.strokeStyle = spec.color;
  ctx.lineWidth = Math.max(1, d);
  const t = performance.now() / 1000;
  for (const p of drops) {
    p.x += (spec.vx * p.s + (spec.wob ? Math.sin(t * 2 + p.ph) * spec.wob : 0)) * dt * d;
    p.y += spec.vy * p.s * dt * d;
    if (p.y > H + 20) { p.y = -10; p.x = Math.random() * (W + 200); }
    if (p.y < -20) { p.y = H + 10; p.x = Math.random() * W; }
    if (p.x < -30) p.x = W + 20;
    if (p.x > W + 220) p.x = -10;
    if (spec.len) {
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + spec.vx * 0.015 * d, p.y + spec.len * d * p.s); ctx.stroke();
    } else if (spec.leaf) {
      ctx.fillStyle = Math.sin(p.ph) > 0 ? '#9bd164' : '#e8a24a';
      const sz = spec.size * d * p.s;
      ctx.fillRect(p.x, p.y, sz * (1 + Math.sin(t * 5 + p.ph) * 0.5), sz);
    } else {
      const sz = spec.size * d * p.s;
      ctx.fillRect(p.x, p.y, sz, sz);
    }
  }
  if (kind === 'storm') {
    if (lightning <= 0 && Math.random() < dt * 0.15) lightning = 0.25;
    if (lightning > 0) {
      lightning -= dt;
      ctx.fillStyle = `rgba(230,240,255,${Math.max(0, lightning) * 2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (kind === 'rain' || kind === 'storm') { ctx.fillStyle = 'rgba(30,40,70,0.12)'; ctx.fillRect(0, 0, W, H); }
  if (kind === 'blizzard') { ctx.fillStyle = 'rgba(230,240,255,0.12)'; ctx.fillRect(0, 0, W, H); }
  if (kind === 'dust') { ctx.fillStyle = 'rgba(220,150,80,0.12)'; ctx.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------------ Minimap
const BASE = [[124, 178, 70], [232, 176, 104], [226, 228, 240]];
export function renderMinimap(canvas, scale = 1, opts = {}) {
  const w = G.world;
  const N = opts.window || w.W;
  const ox = opts.window ? Math.max(0, Math.min(w.W - N, G.player.x - (N >> 1))) : 0;
  const oy = opts.window ? Math.max(0, Math.min(w.H - N, G.player.y - (N >> 1))) : 0;
  canvas.width = N * scale; canvas.height = N * scale;
  const c = canvas.getContext('2d');
  const data = c.createImageData(w.W, w.H);
  for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) {
    const i = y * w.W + x, o = i * 4;
    let col;
    if (!w.explored[i] && !opts.reveal) col = [18, 14, 26];
    else {
      const t = w.terr[i], ob = w.obj[i];
      if (t === TERR.WATER) col = [62, 128, 196];
      else if (t === TERR.ROAD) col = [168, 112, 70];
      else if (ob >= 0 && OBJECTS[ob].kind === 'tree') col = w.biome[i] === BIOME.SNOW ? [170, 190, 190] : w.biome[i] === BIOME.SAND ? [120, 80, 60] : [52, 110, 50];
      else if (ob >= 0 && OBJECTS[ob].kind === 'rock') col = [120, 120, 120];
      else col = BASE[w.biome[i]];
    }
    data.data[o] = col[0]; data.data[o + 1] = col[1]; data.data[o + 2] = col[2]; data.data[o + 3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = w.W; tmp.height = w.H;
  tmp.getContext('2d').putImageData(data, 0, 0);
  c.imageSmoothingEnabled = false;
  c.drawImage(tmp, ox, oy, N, N, 0, 0, N * scale, N * scale);
  const dot = (x, y, color, r = 1.5) => {
    x -= ox; y -= oy;
    if (x < 0 || y < 0 || x > N || y > N) return;
    c.fillStyle = '#000'; c.fillRect((x - 0.5) * scale - r, (y - 0.5) * scale - r, r * 2 + 2, r * 2 + 2);
    c.fillStyle = color; c.fillRect((x - 0.5) * scale - r + 1, (y - 0.5) * scale - r + 1, r * 2, r * 2);
  };
  for (const p of w.pois) {
    if (p.gone || (!w.explored[p.y * w.W + p.x] && !opts.reveal && !p.bounty)) continue;
    const r = Math.max(1.5, scale * 0.9);
    if (p.type === 'village') dot(p.x, p.y, '#ffd23d', r * 1.3);
    else if (p.type === 'den' && !p.cleared) dot(p.x, p.y, p.bounty ? '#ff9b3b' : '#ff4a4a', r);
    else if (p.type === 'boss' && !p.cleared) dot(p.x, p.y, '#ff2a6a', r * 1.6);
    else if (p.type === 'shrine' && !p.used) dot(p.x, p.y, '#9fdcff', r * 0.9);
    else if (p.type === 'chest') dot(p.x, p.y, '#f0c060', r * 0.7);
  }
  const blink = Math.floor(performance.now() / 400) % 2 === 0;
  dot(G.player.x + 0.5, G.player.y + 0.5, blink ? '#ffffff' : '#7fd0ff', Math.max(2, scale * 1.2));
}
