// DOM helpers for overlays, HUD and modals.
import { url, sfx } from './assets.js';
import { spritePaths } from './data.js';
import { itemName, itemIcon, itemDescription, stats, maxHp, XP_TO_LEVEL } from './units.js';

export const root = document.getElementById('ui');

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function button(label, onClick, cls = '', disabled = false) {
  return h('button', {
    class: `btn ${cls}`, disabled,
    onClick: (e) => { e.stopPropagation(); if (disabled) return; sfx('accept', 0.6); onClick(e); },
  }, label);
}

export const faceUrl = (sprite) => url(spritePaths(sprite).face);
export function faceImg(sprite, cls = '') { return h('img', { class: `face ${cls}`, src: faceUrl(sprite), alt: '' }); }

// ---------------- Modal stack
const modals = [];
export function openModal(content, { onClose = null, dismissable = true, cls = '' } = {}) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: `modal panel ${cls}` }, content);
  back.appendChild(box);
  const close = () => {
    const i = modals.indexOf(entry);
    if (i >= 0) modals.splice(i, 1);
    back.remove();
    if (onClose) onClose();
  };
  const entry = { back, close };
  if (dismissable) back.addEventListener('pointerdown', (e) => { if (e.target === back) { sfx('cancel', 0.5); close(); } });
  box.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.appendChild(back);
  modals.push(entry);
  return close;
}
export const modalOpen = () => modals.length > 0;
export function closeAllModals() { while (modals.length) modals[modals.length - 1].close(); }

// ---------------- Toast
let toastEl = null, toastTimer = 0;
export function toast(text, ms = 1800) {
  if (!toastEl) { toastEl = h('div', { id: 'toast', class: 'panel' }); root.appendChild(toastEl); }
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ---------------- Generic pieces
export function hpBar(u) {
  const f = Math.max(0, u.hp / maxHp(u));
  return h('div', { class: 'bar' }, h('i', { style: { width: `${f * 100}%` } }));
}
export function xpBar(u) {
  const f = Math.min(1, u.xp / XP_TO_LEVEL(u.level));
  return h('div', { class: 'bar xp' }, h('i', { style: { width: `${f * 100}%` } }));
}

export function itemSlot(it, onClick = null) {
  const el = h('div', { class: `slot ${it && it.tier ? 't' + it.tier : ''}`, onClick, style: onClick ? { cursor: 'pointer' } : null },
    it ? h('img', { src: url(itemIcon(it)), alt: '' }) : null);
  return el;
}

export function itemCard(it, actions = []) {
  return h('div', { class: 'card panel inset' },
    itemSlot(it),
    h('div', { class: 'info' },
      h('div', { class: `tname t${it.tier || 1}` }, itemName(it)),
      h('div', { class: 'small dim', style: { whiteSpace: 'pre-wrap' } }, itemDescription(it))),
    actions.length ? h('div', { class: 'col' }, actions) : null);
}

export function unitStatLine(u) {
  const s = stats(u);
  return h('div', { class: 'statline' },
    h('span', {}, 'HP ', h('b', {}, `${u.hp}/${s.hpMax}`)),
    h('span', {}, 'ATK ', h('b', {}, s.atk)),
    h('span', {}, 'DEF ', h('b', {}, s.def)),
    h('span', {}, 'MOV ', h('b', {}, s.mov)),
    h('span', {}, 'RNG ', h('b', {}, s.range[0] === s.range[1] ? s.range[0] : `${s.range[0]}-${s.range[1]}`)),
    h('span', {}, 'DODGE ', h('b', {}, s.dodge)),
    h('span', {}, 'CRIT ', h('b', {}, `${s.crit}%`)));
}

// ---------------- Bottom bar & HUD containers
let hudEl = null, barEl = null;
export function hudContainer() { if (!hudEl) { hudEl = h('div', { id: 'hud' }); root.appendChild(hudEl); } return hudEl; }
export function bottomBar() { if (!barEl) { barEl = h('div', { id: 'bottombar' }); root.appendChild(barEl); } return barEl; }
export function clearHud() { if (hudEl) hudEl.innerHTML = ''; if (barEl) barEl.innerHTML = ''; }

// append that ignores null/false (Element.append would print "null")
export function add(parent, ...kids) {
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) parent.append(k);
  return parent;
}
