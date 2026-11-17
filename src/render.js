// Canvas rendering for the shared map (world + battle use the same terrain).
import { img, ready } from './assets.js';
import { TILE, spritePaths, FX, BOSSES } from './data.js';
import { SHEETS, GROUND, ROAD_SET, WATER_SET, TERR, OBJECTS, POI_ART, patchTile, sheet } from './tiles.js';

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

export const view = { w: 0, h: 0, dpr: 1, S: 3, camX: 0, camY: 0 };

export function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 3);
  view.w = Math.floor(window.innerWidth * view.dpr);
  view.h = Math.floor(window.innerHeight * view.dpr);
  canvas.width = view.w; canvas.height = view.h;
  ctx.imageSmoothingEnabled = false;
}

// Choose a scale so roughly `tilesAcross` tiles fit the short side.
export function worldScale() {
  const cssTile = Math.min(window.innerWidth, window.innerHeight) < 600 ? 40 : 52;
  return Math.max(2, Math.round((cssTile * view.dpr) / TILE));
}

// ------------------------------------------------------------------ Ground pre-render
export function buildGround(world) {
  const c = document.createElement('canvas');
  c.width = world.W * TILE; c.height = world.H * TILE;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const floor = img(SHEETS.floor), water = img(SHEETS.water), nature = img(SHEETS.nature);
  const { W, H, biome, terr, variant, obj } = world;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : terr[y * W + x];
  const blit = (im, tx, ty, x, y) => g.drawImage(im, tx * TILE, ty * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, b = biome[i], t = terr[i];
    const gt = GROUND[b][variant[i]];
    blit(floor, gt[0], gt[1], x, y);
    if (t === TERR.ROAD) {
      const same = (dx, dy) => { const v = at(x + dx, y + dy); return v === TERR.ROAD; };
      const p = patchTile(ROAD_SET[b], same(0, -1), same(1, 0), same(0, 1), same(-1, 0));
      blit(floor, p[0], p[1], x, y);
    } else if (t === TERR.WATER) {
      const same = (dx, dy) => { const v = at(x + dx, y + dy); return v === TERR.WATER || v === -1; };
      const p = patchTile(WATER_SET[b], same(0, -1), same(1, 0), same(0, 1), same(-1, 0));
      blit(water, p[0], p[1], x, y);
    }
    const o = obj[i] >= 0 ? OBJECTS[obj[i]] : null;
    if (o && o.decal) g.drawImage(nature, o.sx * TILE, o.sy * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  }
  return c;
}

// ------------------------------------------------------------------ Drawing primitives
const T = () => TILE * view.S;
export const toScreen = (wx, wy) => [Math.round((wx - view.camX) * view.S), Math.round((wy - view.camY) * view.S)];
export const toWorldTile = (sx, sy) => [Math.floor((sx / view.S + view.camX) / TILE), Math.floor((sy / view.S + view.camY) / TILE)];

export function visibleTileRect(world) {
  const x0 = Math.max(0, Math.floor(view.camX / TILE) - 2), y0 = Math.max(0, Math.floor(view.camY / TILE) - 2);
  const x1 = Math.min(world.W - 1, Math.ceil((view.camX + view.w / view.S) / TILE) + 2);
  const y1 = Math.min(world.H - 1, Math.ceil((view.camY + view.h / view.S) / TILE) + 2);
  return { x0, y0, x1, y1 };
}

export function drawGround(groundCanvas) {
  const S = view.S;
  const sx = view.camX, sy = view.camY, sw = view.w / S, sh = view.h / S;
  ctx.fillStyle = '#2d5d7b';
  ctx.fillRect(0, 0, view.w, view.h);
  // clamp source rect to the canvas bounds and offset destination accordingly
  const cx0 = Math.max(0, sx), cy0 = Math.max(0, sy);
  const cx1 = Math.min(groundCanvas.width, sx + sw), cy1 = Math.min(groundCanvas.height, sy + sh);
  if (cx1 <= cx0 || cy1 <= cy0) return;
  ctx.drawImage(groundCanvas, cx0, cy0, cx1 - cx0, cy1 - cy0,
    Math.round((cx0 - sx) * S), Math.round((cy0 - sy) * S), Math.round((cx1 - cx0) * S), Math.round((cy1 - cy0) * S));
}

export function drawSheetRect(sheetKey, sx, sy, w, h, wx, wy, alpha = 1) {
  const im = sheet(sheetKey);
  if (!ready(im)) return;
  const [x, y] = toScreen(wx, wy);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(im, sx, sy, w, h, x, y, w * view.S, h * view.S);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// Static object on tile (x,y): bottom-centered
export function objectDrawable(o, x, y) {
  const wpx = o.w * TILE, hpx = o.h * TILE;
  const wx = x * TILE + TILE / 2 - wpx / 2, wy = (y + 1) * TILE - hpx;
  return { z: (y + 1) * TILE - 0.5, draw: () => drawSheetRect(o.sheet, o.sx * TILE, o.sy * TILE, wpx, hpx, wx, wy) };
}

export function poiArtDrawable(artKey, x, y, extra = null, faded = false) {
  const a = POI_ART[artKey];
  if (a.invisible) return { z: (y + 1) * TILE, draw: () => { if (extra) extra(); } };
  const wx = (x - a.ax) * TILE, wy = (y - a.ay) * TILE;
  return { z: (y + 1) * TILE - 0.4, draw: () => { drawSheetRect(a.sheet, a.sx * TILE, a.sy * TILE, a.w * TILE, a.h * TILE, wx, wy, faded ? 0.55 : 1); if (extra) extra(); } };
}

export function drawIcon(path, wx, wy, size = 16, frameW = 0) {
  const im = img(path);
  if (!ready(im)) return;
  const [x, y] = toScreen(wx, wy);
  const iw = frameW || im.width;
  const s = view.S, scale = Math.min(size / iw, size / im.height);
  const w = iw * scale, h = im.height * scale;
  ctx.drawImage(im, 0, 0, iw, im.height, Math.round(x + (size - w) / 2 * s), Math.round(y + (size - h) / 2 * s), Math.round(w * s), Math.round(h * s));
}

const shadowImg = () => img('Actor/Character/Shadow.png');

// Actor: sprite = {kind:'char'|'monster', name}. dir: 0 down,1 up,2 left,3 right. frame 0-3. pose 'walk'|'attack'
export function drawActor(sprite, wx, wy, dir = 0, frame = 0, opts = {}) {
  const { sheet: sp } = spritePaths(sprite);
  const im = img(sp);
  if (!ready(im)) return;
  const S = view.S;
  const [x, y] = toScreen(wx, wy);
  const sh = shadowImg();
  if (ready(sh) && !opts.noShadow) ctx.drawImage(sh, 0, 0, sh.width, sh.height, x + (TILE - sh.width) / 2 * S, y + (TILE - sh.height - 0.5) * S, sh.width * S, sh.height * S);
  if (opts.ring) {
    ctx.fillStyle = opts.ring;
    ctx.beginPath();
    ctx.ellipse(x + 8 * S, y + 14 * S, 7 * S, 3 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (sprite.kind === 'boss') {
    const b = BOSSES[sprite.name], fh = im.height, fw = b.fw;
    const f = Math.floor(performance.now() / 140) % b.frames;
    const dx = x + (TILE / 2 - fw / 2) * S, dy = y + (TILE - fh + 2) * S + (opts.bob || 0) * S;
    if (opts.ring) {
      ctx.fillStyle = opts.ring;
      ctx.beginPath(); ctx.ellipse(x + 8 * S, y + 14 * S, fw * 0.4 * S, 5 * S, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.flash) ctx.filter = 'brightness(3)';
    if (sprite.flip) { ctx.save(); ctx.translate(dx + fw * S, dy); ctx.scale(-1, 1); ctx.drawImage(im, f * fw, 0, fw, fh, 0, 0, fw * S, fh * S); ctx.restore(); }
    else ctx.drawImage(im, f * fw, 0, fw, fh, dx, dy, fw * S, fh * S);
    ctx.filter = 'none'; ctx.globalAlpha = 1;
    return;
  }
  let row = frame % 4;
  if (sprite.kind !== 'monster' && opts.pose === 'attack') row = 4;
  const bob = opts.bob ? Math.round(opts.bob) : 0;
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.flash) ctx.filter = 'brightness(3)';
  ctx.drawImage(im, dir * 16, row * 16, 16, 16, x, y + (bob - 3) * S, 16 * S, 16 * S);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
}

export function drawHpBar(wx, wy, frac, color = '#e0493f') {
  const S = view.S;
  const [x, y] = toScreen(wx + 1, wy + 15);
  ctx.fillStyle = '#140d10';
  ctx.fillRect(x - S, y, 16 * S, 3 * S);
  ctx.fillStyle = '#3a2224';
  ctx.fillRect(x, y + S * 0.5, 14 * S, 2 * S);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + S * 0.5, Math.max(0, Math.round(14 * frac)) * S, 2 * S);
}

export function fillTile(x, y, color) {
  const [sx, sy] = toScreen(x * TILE, y * TILE);
  ctx.fillStyle = color;
  ctx.fillRect(sx, sy, T(), T());
}
export function strokeTile(x, y, color, w = 1) {
  const S = view.S;
  const [sx, sy] = toScreen(x * TILE, y * TILE);
  ctx.strokeStyle = color; ctx.lineWidth = w * S;
  ctx.strokeRect(sx + w * S / 2, sy + w * S / 2, T() - w * S, T() - w * S);
}

// FX animation instance
export function drawFx(fx, wx, wy, t) {
  const f = FX[fx.kind];
  const im = img(f.path);
  if (!ready(im)) return;
  const frame = Math.min(f.frames - 1, Math.floor(t * f.frames));
  const [x, y] = toScreen(wx + TILE / 2 - f.fw / 2, wy + TILE / 2 - f.fh / 2);
  ctx.drawImage(im, frame * f.fw, 0, f.fw, f.fh, x, y, f.fw * view.S, f.fh * view.S);
}

export function drawText(text, wx, wy, color = '#fff', size = 8, alpha = 1) {
  const [x, y] = toScreen(wx, wy);
  ctx.globalAlpha = alpha;
  ctx.font = `${Math.round(size * view.S)}px Ninja, monospace`;
  ctx.textAlign = 'center';
  ctx.lineWidth = Math.max(2, view.S * 1.2);
  ctx.strokeStyle = '#120a0a';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

// Fog of war, drawn as crisp pixel-art cells (4 per tile) with stepped edges.
// Explored state is interpolated between tile centers so edges curve, then
// quantized into a few bands — no smoothing/blur anywhere.
const fogCanvas = document.createElement('canvas');
const fogCtx = fogCanvas.getContext('2d');
const SUB = 8; // cells per tile (2 art-pixels each)
export function drawFog(world, visible, center = null, radius = 7) {
  const r = visibleTileRect(world);
  const tw = r.x1 - r.x0 + 1, th = r.y1 - r.y0 + 1;
  const w = tw * SUB, h = th * SUB;
  if (fogCanvas.width !== w || fogCanvas.height !== h) { fogCanvas.width = w; fogCanvas.height = h; }
  const data = fogCtx.createImageData(w, h);
  const W = world.W, H = world.H, ex = world.explored;
  const E = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : ex[y * W + x];
  const V = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : (visible.has(y * W + x) ? 1 : 0);
  const cx = center ? center.x + 0.5 : 0, cy = center ? center.y + 0.5 : 0;
  const d = data.data;
  for (let sy = 0; sy < h; sy++) {
    const fy = r.y0 + (sy + 0.5) / SUB - 0.5;
    const y0 = Math.floor(fy), ty = fy - y0;
    for (let sx = 0; sx < w; sx++) {
      const fx = r.x0 + (sx + 0.5) / SUB - 0.5;
      const x0 = Math.floor(fx), tx = fx - x0;
      // bilinear explored / visible between tile centers
      const e = (E(x0, y0) * (1 - tx) + E(x0 + 1, y0) * tx) * (1 - ty) + (E(x0, y0 + 1) * (1 - tx) + E(x0 + 1, y0 + 1) * tx) * ty;
      let v = (V(x0, y0) * (1 - tx) + V(x0 + 1, y0) * tx) * (1 - ty) + (V(x0, y0 + 1) * (1 - tx) + V(x0 + 1, y0 + 1) * tx) * ty;
      if (center) { // round light falloff around the player
        const dist = Math.hypot(fx + 0.5 - cx, fy + 0.5 - cy);
        v = Math.min(v, Math.max(0, Math.min(1, (radius - dist) / 1.6)));
      }
      let a = (1 - e) * 1 + e * (1 - v) * 0.45;
      a = Math.round(a * 6) / 6; // stepped bands, pixel-art style
      const o = (sy * w + sx) * 4;
      d[o] = 12; d[o + 1] = 10; d[o + 2] = 20; d[o + 3] = Math.round(a * 255);
    }
  }
  fogCtx.putImageData(data, 0, 0);
  const [px, py] = toScreen(r.x0 * TILE, r.y0 * TILE);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fogCanvas, 0, 0, w, h, px, py, tw * T(), th * T());
}
