// "Juice": screen shake, flashes, particles, banners, iris transitions, VS intros.
import { view, ctx, toScreen } from './render.js';
import { img, ready } from './assets.js';
import { spritePaths } from './data.js';

const J = {
  shake: 0, shakeT: 0, shakeDur: 0,
  flash: 0, flashColor: '#fff', flashDur: 0.2,
  particles: [],
  banners: [],
  trans: null,
  vs: null,
  freeze: 0,
};
export const juice = J;

// ------------------------------------------------------------------ Shake / flash / hit-stop
export function shake(amount = 2, dur = 0.25) {
  if (amount >= J.shake * (J.shakeT / Math.max(0.001, J.shakeDur))) { J.shake = amount; J.shakeT = dur; J.shakeDur = dur; }
}
export function flash(color = '#fff', strength = 0.5, dur = 0.18) { J.flash = strength; J.flashColor = color; J.flashDur = dur; J.flashT = dur; }
export function hitstop(ms = 70) { J.freeze = Math.max(J.freeze, ms / 1000); }

let sx = 0, sy = 0;
export function applyShake() {
  if (J.shakeT > 0) {
    const k = J.shake * (J.shakeT / J.shakeDur);
    sx = (Math.random() * 2 - 1) * k; sy = (Math.random() * 2 - 1) * k;
    view.camX += sx; view.camY += sy;
  } else { sx = 0; sy = 0; }
}
export function restoreShake() { view.camX -= sx; view.camY -= sy; }

// ------------------------------------------------------------------ Particles (world coords)
// p: {x,y,vx,vy,life,max,size,color,g,drag,kind,img,frames,fw,fh,rot,vr,fade,glow}
export function particle(p) {
  p.max = p.life = p.life ?? 0.6;
  p.vx = p.vx ?? 0; p.vy = p.vy ?? 0; p.g = p.g ?? 0; p.drag = p.drag ?? 0.9; p.size = p.size ?? 1.5;
  J.particles.push(p);
  if (J.particles.length > 900) J.particles.splice(0, J.particles.length - 900);
  return p;
}

export function burst(x, y, { n = 10, colors = ['#fff'], speed = 60, life = 0.5, g = 120, size = 1.5, up = 0, spread = Math.PI * 2, angle = -Math.PI / 2, glow = false } = {}) {
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const s = speed * (0.4 + Math.random() * 0.8);
    particle({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: life * (0.6 + Math.random() * 0.6), g,
      size: size * (0.6 + Math.random() * 0.8), color: colors[Math.floor(Math.random() * colors.length)], drag: 0.92, glow,
    });
  }
}

export function sparks(x, y, color = '#ffe08a', n = 12) { burst(x, y, { n, colors: [color, '#fff', color], speed: 110, life: 0.35, g: 200, size: 1.2, glow: true }); }
export function blood(x, y, colors = ['#e0493f', '#a8262a', '#ff8a6b']) { burst(x, y, { n: 10, colors, speed: 70, life: 0.5, g: 260, size: 1.6 }); }
export function dust(x, y, color = '#d9c39a') {
  for (let i = 0; i < 4; i++) particle({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 10, life: 0.4, size: 1.6 + Math.random(), color, drag: 0.85, fade: true });
}
export function coins(x, y, n = 14) {
  burst(x, y, { n, colors: ['#ffd23d', '#ffef9a', '#e0a020'], speed: 90, life: 0.9, g: 260, size: 1.8, up: 40 });
}
export function healMotes(x, y) {
  for (let i = 0; i < 12; i++) particle({ x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 8, vx: 0, vy: -20 - Math.random() * 25, life: 0.9, size: 1.5, color: Math.random() < 0.5 ? '#8fe07a' : '#d6ffc9', drag: 0.97, glow: true });
}
export function smokePuff(x, y, color = '#cfc6bf', n = 10) {
  for (let i = 0; i < n; i++) particle({ x, y, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 30, life: 0.7, size: 2 + Math.random() * 2, color, drag: 0.9, fade: true, grow: 3 });
}
export function levelUpFx(x, y) {
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    particle({ x: x + Math.cos(a) * 9, y: y + Math.sin(a) * 4, vx: 0, vy: -30 - Math.random() * 30, life: 1.1, size: 1.6, color: i % 2 ? '#ffd27a' : '#fff6c9', drag: 0.98, glow: true });
  }
}

export function updateJuice(dt) {
  if (J.shakeT > 0) J.shakeT = Math.max(0, J.shakeT - dt);
  if (J.flashT > 0) J.flashT = Math.max(0, J.flashT - dt);
  if (J.freeze > 0) J.freeze = Math.max(0, J.freeze - dt);
  for (const p of J.particles) {
    p.life -= dt;
    p.vy += p.g * dt;
    const d = Math.pow(p.drag, dt * 60);
    p.vx *= d; p.vy *= d;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.rot != null) p.rot += (p.vr || 0) * dt;
  }
  J.particles = J.particles.filter((p) => p.life > 0);
  for (const b of J.banners) b.t += dt;
  J.banners = J.banners.filter((b) => b.t < b.dur);
  if (J.vs) { J.vs.t += dt; if (J.vs.t > J.vs.dur) J.vs = null; }
}

export function drawParticles() {
  const S = view.S;
  for (const p of J.particles) {
    const k = p.life / p.max;
    const [x, y] = toScreen(p.x, p.y);
    const size = (p.size + (p.grow ? p.grow * (1 - k) : 0)) * S;
    ctx.globalAlpha = p.fade ? k * 0.8 : Math.min(1, k * 2.5);
    if (p.glow) { ctx.globalCompositeOperation = 'lighter'; }
    if (p.img) {
      const im = img(p.img);
      if (ready(im)) {
        const fw = p.fw || im.height, frame = p.frame || 0;
        ctx.drawImage(im, frame * fw, 0, fw, im.height, Math.round(x), Math.round(y), fw * S * (p.scale || 1), im.height * S * (p.scale || 1));
      }
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.ceil(size), Math.ceil(size));
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ Banners (screen space)
export function banner(text, { color = '#ffd27a', sub = '', dur = 1.3, size = 1, band = 'rgba(14,10,22,.78)' } = {}) {
  J.banners = J.banners.filter((b) => b.t > b.dur * 0.6); // newer replaces older
  J.banners.push({ text, color, sub, dur, size, band, t: 0 });
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

function drawBanners() {
  const W = view.w, H = view.h, d = view.dpr;
  for (const b of J.banners) {
    const inT = 0.22, outT = 0.25;
    let off = 0, a = 1;
    if (b.t < inT) { const k = easeOut(b.t / inT); off = (1 - k) * -W; a = k; }
    else if (b.t > b.dur - outT) { const k = easeIn((b.t - (b.dur - outT)) / outT); off = k * W; a = 1 - k; }
    const fs = Math.round(Math.min(64 * d, W / 10) * b.size);
    const bandH = fs * (b.sub ? 2.1 : 1.6);
    const cy = H * 0.42;
    ctx.globalAlpha = a * 0.95;
    ctx.fillStyle = b.band;
    ctx.fillRect(0, cy - bandH / 2, W, bandH);
    ctx.fillStyle = b.color;
    ctx.fillRect(0, cy - bandH / 2, W, 3 * d);
    ctx.fillRect(0, cy + bandH / 2 - 3 * d, W, 3 * d);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${fs}px Ninja, monospace`;
    ctx.lineWidth = Math.max(3, fs / 7);
    ctx.strokeStyle = '#140c10';
    const ty = cy - (b.sub ? fs * 0.25 : 0);
    ctx.strokeText(b.text, W / 2 + off, ty);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, W / 2 + off, ty);
    if (b.sub) {
      ctx.font = `${Math.round(fs * 0.4)}px Ninja, monospace`;
      ctx.lineWidth = Math.max(2, fs / 14);
      ctx.strokeText(b.sub, W / 2 - off * 0.6, cy + fs * 0.62);
      ctx.fillStyle = '#f4e9d4';
      ctx.fillText(b.sub, W / 2 - off * 0.6, cy + fs * 0.62);
    }
    ctx.textBaseline = 'alphabetic';
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ VS intro
export function vsIntro(leftSprite, rightSprite, title, sub = '') {
  J.vs = { left: leftSprite, right: rightSprite, title, sub, t: 0, dur: 1.7 };
}
function drawVs() {
  const v = J.vs; if (!v) return;
  const W = view.w, H = view.h, d = view.dpr;
  const t = v.t, dur = v.dur;
  let k = t < 0.3 ? easeOut(t / 0.3) : 1;
  let out = t > dur - 0.3 ? easeIn((t - (dur - 0.3)) / 0.3) : 0;
  const size = Math.min(W * 0.28, 150 * d);
  const cy = H * 0.4;
  ctx.globalAlpha = (1 - out) * 0.85;
  ctx.fillStyle = 'rgba(10,6,16,.85)';
  ctx.beginPath();
  ctx.moveTo(0, cy - size * 0.75); ctx.lineTo(W, cy - size * 0.95); ctx.lineTo(W, cy + size * 0.75); ctx.lineTo(0, cy + size * 0.95); ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1 - out;
  const face = (s) => img(spritePaths(s).face);
  const lf = face(v.left), rf = face(v.right);
  const lx = -size + k * (W * 0.27) - out * W, rx = W - k * (W * 0.27) - out * -W;
  ctx.imageSmoothingEnabled = false;
  const frame = (im, x) => {
    ctx.fillStyle = '#c9a77e'; ctx.fillRect(x - size / 2 - 4 * d, cy - size / 2 - 4 * d, size + 8 * d, size + 8 * d);
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(x - size / 2, cy - size / 2, size, size);
    if (ready(im)) ctx.drawImage(im, x - size / 2, cy - size / 2, size, size);
  };
  frame(lf, lx); frame(rf, rx);
  const fs = Math.round(Math.min(72 * d, W / 7));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${fs}px Ninja, monospace`;
  const pulse = 1 + Math.max(0, 0.4 - t) * 1.5;
  ctx.save(); ctx.translate(W / 2, cy); ctx.scale(pulse, pulse);
  ctx.lineWidth = fs / 6; ctx.strokeStyle = '#140c10'; ctx.strokeText('VS', 0, 0);
  ctx.fillStyle = '#ff5a4a'; ctx.fillText('VS', 0, 0);
  ctx.restore();
  ctx.font = `${Math.round(fs * 0.42)}px Ninja, monospace`;
  ctx.lineWidth = fs / 10; ctx.strokeText(v.title, W / 2, cy + size * 0.72);
  ctx.fillStyle = '#ffd27a'; ctx.fillText(v.title, W / 2, cy + size * 0.72);
  if (v.sub) {
    ctx.font = `${Math.round(fs * 0.28)}px Ninja, monospace`;
    ctx.strokeText(v.sub, W / 2, cy + size * 0.72 + fs * 0.45);
    ctx.fillStyle = '#f4e9d4'; ctx.fillText(v.sub, W / 2, cy + size * 0.72 + fs * 0.45);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ Iris transition
export function transition(mid, { dur = 0.35, color = '#0c0a14' } = {}) {
  return new Promise((res) => { J.trans = { t: 0, dur, mid, done: false, color, res }; });
}
function drawTransition(dt) {
  const tr = J.trans; if (!tr) return;
  tr.t += dt;
  const W = view.w, H = view.h, R = Math.hypot(W, H) / 2;
  let r;
  if (!tr.done) {
    r = R * (1 - easeIn(Math.min(1, tr.t / tr.dur)));
    if (tr.t >= tr.dur) { tr.done = true; tr.t = 0; try { tr.mid && tr.mid(); } catch (e) { console.error(e); } r = 0; }
  } else {
    r = R * easeOut(Math.min(1, tr.t / tr.dur));
    if (tr.t >= tr.dur + 0.05) { J.trans = null; tr.res(); return; }
  }
  ctx.fillStyle = tr.color;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2, true);
  ctx.fill('evenodd');
}

export function drawScreenFx(dt) {
  if (J.flashT > 0) {
    ctx.globalAlpha = J.flash * (J.flashT / J.flashDur);
    ctx.fillStyle = J.flashColor;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.globalAlpha = 1;
  }
  drawBanners();
  drawVs();
  drawTransition(dt);
}

export const transitioning = () => !!J.trans;
