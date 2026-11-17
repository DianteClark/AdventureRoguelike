// UI screens: HUD, title, party, villages, events, loot, victory and death.
import { G, saveRun, eraseRun, hasSave, loadRun, day, hero, MAX_PARTY, MAX_BAG, recordDeath, graves } from './state.js';
import { BACKGROUNDS, HERO_BACKGROUNDS, HERO_SPRITE, CONSUMABLES, MONSTERS, charFace } from './data.js';
import {
  makeHero, makeRecruit, randomLoot, randomWeapon, randomGear, makeConsumable, itemName, itemValue, stats, maxHp,
  randomName, gainXp, XP_TO_LEVEL,
} from './units.js';
import {
  h, button, openModal, closeAllModals, toast, faceImg, faceUrl, hpBar, xpBar, itemSlot, itemCard, unitStatLine,
  hudContainer, bottomBar, clearHud, root, modalOpen, add,
} from './ui.js';
import { url, sfx, playMusic, audio, toggleMusic, toggleSfx } from './assets.js';
import { rand, RNG } from './rng.js';
import { TRAVEL_EVENTS, WANDERER_EVENTS, SHRINE_EVENT } from './events.js';
import { tierAt, makeGroup } from './worldgen.js';
import { BIOME } from './tiles.js';

// late-bound to avoid import cycles
let api = {};
export function bindApi(a) { api = a; }

// ------------------------------------------------------------------ HUD
export function renderHud() {
  clearHud();
  if (G.scene !== 'world' && G.scene !== 'battle') return;
  const hud = hudContainer();
  const stats = h('div', { class: 'panel hud-stats' },
    h('span', {}, h('img', { src: url('Items/Object/MoneyBag.png'), class: 'icon' }), ` ${G.gold}`),
    h('span', {}, `Day ${day()}`));
  const party = h('div', { class: 'hud-party' },
    G.party.map((u) => h('div', { class: `hud-member ${u.alive ? '' : 'dead'}`, onClick: () => { if (G.scene === 'world') showParty(u); } },
      h('img', { src: faceUrl(spriteOf(u)), alt: u.name }), hpBar(u))));
  add(hud, stats, party, h('div', { class: 'right' }, button('≡', showMenu, 'small')));
  if (G.scene === 'world') {
    const bar = bottomBar();
    add(bar, button('Party', () => showParty()), button(`Bag ${G.bag.length}/${MAX_BAG}`, () => showParty(null, 'bag')));
  }
}

export const spriteOf = (u) => (u.kind === 'monster' ? { kind: 'monster', name: u.sprite } : { kind: 'char', name: u.sprite });

function showMenu() {
  const close = openModal(h('div', { class: 'col' },
    h('h2', {}, 'Menu'),
    h('div', { class: 'small dim' }, `Run seed ${G.world ? G.world.seed : '-'} · Battles ${G.stats.battles} · Kills ${G.stats.kills}`),
    button(`Music: ${audio.musicOn ? 'On' : 'Off'}`, () => { toggleMusic(); close(); showMenu(); }),
    button(`Sound: ${audio.sfxOn ? 'On' : 'Off'}`, () => { toggleSfx(); close(); showMenu(); }),
    button('How to play', () => { close(); showHelp(); }),
    G.scene === 'world' ? button('Abandon run', () => {
      close();
      confirmBox('Abandon this run? Your hero will be lost forever.', () => { showDeath({ cause: 'Abandoned the journey', fallen: [] }); });
    }) : null,
    button('Close', () => close())));
}

function confirmBox(text, onYes) {
  const close = openModal(h('div', { class: 'col' },
    h('div', { class: 'dialog-text' }, text),
    h('div', { class: 'row' }, button('Yes', () => { close(); onYes(); }), button('No', () => close()))));
}

export function showHelp(onDone = null) {
  openModal(h('div', { class: 'col' },
    h('h2', {}, 'How to play'),
    h('div', { class: 'dialog-text small' },
      '• Tap the map to travel. Fog hides what you have not seen.\n' +
      '• Red rings are monster packs. Get close and a battle starts on the ground you stand on.\n' +
      '• Villages: rest, hire companions, buy and sell gear.\n' +
      '• ? statues are shrines, ! huts are lairs with treasure, ... are travelers.\n\n' +
      'BATTLE\n• Tap a blue unit, then a blue tile to move. Red tiles are foes in reach.\n' +
      '• Tap a foe to see the forecast, tap again (or Attack) to strike. Foes may counter.\n' +
      '• Tap an enemy any time to see its danger zone.\n' +
      '• Bushes give cover (+15 dodge).\n\n' +
      'If your leader (★) falls, the run is over. Companions who fall are gone for good.'),
    button('Got it', () => { closeAllModals(); if (onDone) onDone(); })), { onClose: onDone });
}

// ------------------------------------------------------------------ Title
export function showTitle() {
  clearHud();
  closeAllModals();
  playMusic('title');
  const el = h('div', { class: 'title-screen' });
  const g = graves();
  add(el, 
    h('h1', {}, 'Ronin Roads'),
    h('div', { class: 'dim' }, 'A tactical roguelike. One life. Walk alone or gather a band.'),
    hasSave() ? button('Continue journey', () => { el.remove(); if (loadRun()) api.resumeRun(); else toast('Save could not be loaded'); }) : null,
    button('New journey', () => { el.remove(); showHeroPick(); }),
    g.length ? h('div', { class: 'panel small', style: { maxWidth: '360px' } },
      h('div', {}, 'Fallen heroes'),
      g.slice(0, 4).map((d) => h('div', { class: 'dim' }, `${d.name} the ${d.bg} — day ${d.day}, ${d.kills} kills. ${d.cause}`))) : null,
  );
  root.appendChild(el);
}

function showHeroPick() {
  const opts = rand.shuffle(HERO_BACKGROUNDS.slice()).slice(0, 3);
  let sel = opts[0];
  let name = randomName();
  const wrap = h('div', { class: 'title-screen' });
  const render = () => {
    wrap.innerHTML = '';
    add(wrap, 
      h('h2', {}, 'Who walks the road?'),
      h('div', { class: 'row' }, h('span', { class: 'big' }, name), button('↻', () => { name = randomName(); render(); }, 'small')),
      h('div', { class: 'hero-pick' }, opts.map((k) => {
        const bg = BACKGROUNDS[k];
        return h('div', { class: `panel ${sel === k ? 'sel' : ''}`, onClick: () => { sel = k; sfx('menu', 0.5); render(); } },
          h('div', { class: 'row' }, h('img', { class: 'face sm', src: url(charFace(HERO_SPRITE[k])) }), h('h3', {}, bg.label)),
          h('div', { class: 'small dim', style: { marginTop: '4px' } }, bg.desc),
          h('div', { class: 'small', style: { marginTop: '4px' } }, `HP ${bg.stats.hp + 6} · ATK ${bg.stats.atk + 1} · DEF ${bg.stats.def} · MOV ${bg.stats.mov}`));
      })),
      h('div', { class: 'row' }, button('Begin', () => { wrap.remove(); api.newRun(sel, HERO_SPRITE[sel], name); }), button('Back', () => { wrap.remove(); showTitle(); })),
    );
  };
  render();
  root.appendChild(wrap);
}

// ------------------------------------------------------------------ Party & bag
export function showParty(focus = null, tab = 'party') {
  let sel = focus || G.party[0];
  const body = h('div');
  const close = openModal(body, { onClose: () => renderHud() });
  const render = () => {
    body.innerHTML = '';
    add(body, h('div', { class: 'title' }, h('h2', { class: 'grow' }, `Party ${G.party.length}/${MAX_PARTY}`), button('✕', () => close(), 'small')));
    // member list
    add(body, h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
      G.party.map((u) => h('div', { onClick: () => { sel = u; sfx('menu', 0.4); render(); }, style: { cursor: 'pointer', outline: u === sel ? '3px solid #ffd27a' : 'none', borderRadius: '6px' } },
        faceImg(spriteOf(u), 'sm')))));
    if (sel) add(body, unitDetail(sel, render, close));
    add(body, h('div', { class: 'sep' }));
    add(body, h('h3', {}, `Bag ${G.bag.length}/${MAX_BAG}`));
    if (!G.bag.length) add(body, h('div', { class: 'dim small' }, 'Empty. Loot from battles, chests and markets lands here.'));
    for (const it of G.bag) {
      const actions = [];
      if (it.kind === 'consumable') actions.push(button('Use', () => { useConsumable(it, sel); render(); }, 'small', !sel || sel.hp >= maxHp(sel)));
      else actions.push(button(`Equip`, () => { equip(sel, it); render(); }, 'small', !sel));
      add(body, itemCard(it, actions));
    }
  };
  render();
}

function unitDetail(u, rerender, close) {
  const bg = BACKGROUNDS[u.bg];
  return h('div', { class: 'panel inset', style: { marginTop: '6px' } },
    h('div', { class: 'row' },
      faceImg(spriteOf(u)),
      h('div', { class: 'grow' },
        h('h3', {}, `${u.hero ? '★ ' : ''}${u.name}`),
        h('div', { class: 'small dim' }, `Lv ${u.level} ${bg ? bg.label : ''} · XP ${u.xp}/${XP_TO_LEVEL(u.level)} · Kills ${u.kills || 0}`),
        hpBar(u), xpBar(u))),
    unitStatLine(u),
    u.quirk ? h('div', { class: 'small dim', style: { marginTop: '4px' } }, `"${u.quirk}"`) : null,
    h('div', { class: 'small', style: { marginTop: '6px' } }, 'Weapon'),
    u.weapon ? itemCard(u.weapon, [button('Unequip', () => { unequip(u, 'weapon'); rerender(); }, 'small', G.bag.length >= MAX_BAG)]) : h('div', { class: 'dim small' }, 'Bare hands'),
    h('div', { class: 'small' }, 'Gear'),
    u.gear ? itemCard(u.gear, [button('Unequip', () => { unequip(u, 'gear'); rerender(); }, 'small', G.bag.length >= MAX_BAG)]) : h('div', { class: 'dim small' }, 'None'),
    !u.hero ? h('div', { style: { marginTop: '6px' } }, button('Dismiss', () => {
      confirmBox(`Send ${u.name} away? Their equipment goes with them.`, () => { G.party = G.party.filter((x) => x !== u); saveRun(); close(); renderHud(); showParty(); });
    }, 'small')) : null);
}

function equip(u, it) {
  const slot = it.kind === 'weapon' ? 'weapon' : 'gear';
  const old = u[slot];
  const hpBefore = maxHp(u);
  u[slot] = it;
  G.bag = G.bag.filter((x) => x !== it);
  if (old) G.bag.push(old);
  const diff = maxHp(u) - hpBefore;
  u.hp = Math.max(1, Math.min(maxHp(u), u.hp + Math.max(0, diff)));
  sfx('accept', 0.5);
  saveRun();
}
function unequip(u, slot) {
  if (!u[slot] || G.bag.length >= MAX_BAG) return;
  G.bag.push(u[slot]); u[slot] = null;
  u.hp = Math.min(u.hp, maxHp(u));
  saveRun();
}
function useConsumable(it, u) {
  const c = CONSUMABLES[it.id];
  u.hp = Math.min(maxHp(u), u.hp + Math.ceil(maxHp(u) * c.heal));
  G.bag = G.bag.filter((x) => x !== it);
  sfx('heal', 0.6);
  saveRun();
}

export function addToBag(it) {
  if (G.bag.length >= MAX_BAG) { const g = Math.round(itemValue(it) * 0.4); G.gold += g; toast(`Bag full — sold ${itemName(it)} for ${g}g`); return false; }
  G.bag.push(it); return true;
}

// ------------------------------------------------------------------ Event runner
function eventCtx(extra = {}) {
  const tier = tierAt(G.player.x, G.player.y, G.world.start, G.world.biome[G.player.y * G.world.W + G.player.x]);
  const c = {
    rng: rand, tier,
    hero: () => hero(),
    goldNow: () => G.gold,
    hasGold: (n) => G.gold >= n,
    gold: (n) => { const v = Math.max(-G.gold, n); G.gold += v; if (v > 0) sfx('coin', 0.6); return v; },
    healAll: (f) => { for (const u of G.party) u.hp = Math.min(maxHp(u), u.hp + Math.ceil(maxHp(u) * f)); sfx('heal', 0.6); },
    hurtAll: (n) => { for (const u of G.party) u.hp = Math.max(1, u.hp - n); sfx('hit', 0.6); },
    xpAll: (n) => { for (const u of G.party) { const l = gainXp(u, n); if (l) toast(`${u.name} reached level ${l.level}!`); } },
    item: (t) => { const it = randomLoot(Math.max(1, Math.min(5, t))); addToBag(it); sfx('bonus', 0.6); return itemName(it); },
    partyFull: () => G.party.length >= MAX_PARTY,
    recruit: (t, free, bgKey) => {
      let u = makeRecruit(t, rand, G.party.map((p) => p.name));
      if (bgKey) for (let i = 0; i < 20 && u.bg !== bgKey; i++) u = makeRecruit(t, rand, G.party.map((p) => p.name));
      G.party.push(u); sfx('levelup', 0.6); return u.name;
    },
    blessMaxHp: (n) => { for (const u of G.party) { u.base.hp += n; u.hp += n; } },
    blessAtk: (u, n) => { u.base.atk += n; return u.name; },
    pickRandomUnit: () => rand.pick(G.party),
    reveal: (r) => {
      const { x, y } = G.player, w = G.world;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w.W && ny < w.H && dx * dx + dy * dy <= r * r) w.explored[ny * w.W + nx] = 1;
      }
    },
    wasteSteps: (n) => { G.steps += n; },
    bounty: () => {
      const dens = G.world.pois.filter((p) => p.type === 'den' && !p.cleared && !p.bounty);
      if (!dens.length) { G.gold += 15; return false; }
      dens.sort((a, b) => Math.abs(a.x - G.player.x) + Math.abs(a.y - G.player.y) - Math.abs(b.x - G.player.x) - Math.abs(b.y - G.player.y));
      const d = dens[0];
      d.bounty = 60 + d.tier * 30;
      c.reveal(0);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = d.x + dx, ny = d.y + dy;
        if (nx >= 0 && ny >= 0 && nx < G.world.W && ny < G.world.H) G.world.explored[ny * G.world.W + nx] = 1;
      }
      return true;
    },
    fight: (o) => { pendingFight = o; },
    shop: () => { pendingShop = true; },
    ...extra,
  };
  return c;
}
let pendingFight = null, pendingShop = false;

export function runEvent(ev, face, onDone = null) {
  G.stats.events++;
  sfx('voice', 0.5);
  const body = h('div');
  const close = openModal(body, { dismissable: false });
  const c = eventCtx();
  const showText = (text, after) => {
    body.innerHTML = '';
    add(body, h('div', { class: 'row', style: { alignItems: 'flex-start' } }, faceImg(face), h('div', { class: 'grow' }, h('h3', {}, ev.title), h('div', { class: 'dialog-text' }, text))));
    const ch = h('div', { class: 'choices' });
    after(ch);
    add(body, ch);
  };
  showText(ev.text, (ch) => {
    for (const choice of ev.choices) {
      const ok = !choice.req || choice.req(c);
      add(ch, button(choice.label, () => {
        pendingFight = null; pendingShop = false;
        const result = choice.run(c);
        renderHud();
        if (pendingFight) {
          const fo = pendingFight; pendingFight = null;
          close();
          fightHere(fo);
          return;
        }
        if (pendingShop) { pendingShop = false; close(); showMerchant(onDone); return; }
        showText(result || '...', (ch2) => add(ch2, button('Continue', () => { close(); saveRun(); if (onDone) onDone(); })));
      }, '', !ok));
    }
  });
}

function fightHere(o) {
  const b = G.world.biome[G.player.y * G.world.W + G.player.x];
  const tier = tierAt(G.player.x, G.player.y, G.world.start, b);
  let g = makeGroup(tier, b, rand);
  if (o.bandits) for (let i = 0; i < 10 && g.name !== 'Bandits'; i++) g = makeGroup(Math.max(2, tier), b, rand);
  // spawn a few tiles away
  const dirs = rand.shuffle([[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, -3]]);
  let anchor = { x: G.player.x + 3, y: G.player.y };
  for (const [dx, dy] of dirs) {
    const x = G.player.x + dx, y = G.player.y + dy;
    if (!api.tileBlocked(x, y)) { anchor = { x, y }; break; }
  }
  api.startBattle({ members: g.members, name: g.name, anchor, tier, noRetreat: !!o.noRetreat });
}

export function randomTravelEvent() {
  const ev = rand.pick(TRAVEL_EVENTS);
  runEvent(ev, ev.face);
}

// ------------------------------------------------------------------ Points of interest
export function interactPoi(poi) {
  if (poi.type === 'village') return showVillage(poi);
  if (poi.type === 'chest') return openChest(poi);
  if (poi.type === 'wanderer') {
    const ev = WANDERER_EVENTS[(poi.evIndex ?? (poi.evIndex = rand.int(0, WANDERER_EVENTS.length - 1)))];
    runEvent(ev, { kind: 'char', name: poi.sprite }, () => { poi.gone = true; api.refreshWorld(); });
    return;
  }
  if (poi.type === 'shrine') {
    if (poi.used) { toast('The shrine is silent now.'); return; }
    runEvent(SHRINE_EVENT, { kind: 'char', name: 'Statue' }, () => {});
    poi.used = true;
    return;
  }
  if (poi.type === 'den') {
    if (poi.cleared) { toast('An empty, ransacked lair.'); return; }
    const g = poi.group;
    const lead = g.leader;
    const close = openModal(h('div', { class: 'col' },
      h('div', { class: 'row', style: { alignItems: 'flex-start' } }, faceImg(lead),
        h('div', {}, h('h3', {}, `Lair: ${g.name}`),
          h('div', { class: 'dialog-text' }, `Bones and broken weapons litter the entrance. ${g.members.length} foes lurk inside, guarding a hoard.${poi.bounty ? `\n\nBounty: ${poi.bounty} gold.` : ''}`),
          h('div', { class: 'small dim' }, `Threat: ${'☠'.repeat(poi.tier)}`))),
      h('div', { class: 'row' },
        button('Attack the lair', () => {
          close();
          api.startBattle({
            members: g.members, name: g.name, anchor: { x: poi.x, y: poi.y + 1 }, tier: poi.tier, elite: true, lootBonus: 1,
            onWin: () => { poi.cleared = true; if (poi.bounty) { G.gold += poi.bounty; toast(`Bounty collected: ${poi.bounty} gold`); } },
          });
        }),
        button('Leave', () => close()))));
  }
}

function openChest(poi) {
  const b = G.world.biome[poi.y * G.world.W + poi.x];
  const tier = tierAt(poi.x, poi.y, G.world.start, b);
  poi.gone = true;
  api.refreshWorld();
  G.stats.chests++;
  sfx('bonus', 0.7);
  if (rand.chance(0.12)) {
    for (const u of G.party) u.hp = Math.max(1, u.hp - 3);
    toast('A trapped chest! Needles fly out. (-3 HP all)');
    renderHud();
    return;
  }
  const gold = rand.int(8, 20) * tier;
  G.gold += gold;
  const it = randomLoot(Math.min(5, tier + (rand.chance(0.2) ? 1 : 0)));
  addToBag(it);
  openModal(h('div', { class: 'col' },
    h('h3', {}, 'Treasure!'),
    h('div', {}, `${gold} gold`),
    itemCard(it),
    button('Take it', () => closeAllModals())), { onClose: () => { renderHud(); saveRun(); } });
}

// ------------------------------------------------------------------ Village
function villageStock(poi) {
  const b = G.world.biome[poi.y * G.world.W + poi.x];
  const tier = tierAt(poi.x, poi.y, G.world.start, b);
  if (!poi.stock || day() - poi.stock.day >= 3) {
    const rng = new RNG((G.world.seed ^ (poi.x * 73856093) ^ (poi.y * 19349663) ^ (day() * 83492791)) >>> 0);
    const recruits = [];
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) recruits.push(makeRecruit(tier, rng, G.party.map((p) => p.name)));
    const items = [];
    for (let i = 0; i < 4; i++) {
      const t = Math.max(1, Math.min(5, tier + rng.int(-1, 1)));
      items.push(rng.chance(0.5) ? randomWeapon(t, rng) : randomGear(t, rng));
    }
    poi.stock = { day: day(), recruits, items, tier };
  }
  return poi.stock;
}

export function showVillage(poi) {
  if (!poi.visited) { poi.visited = true; G.stats.villages++; }
  playMusic('village');
  const stock = villageStock(poi);
  let tab = 'inn';
  const body = h('div');
  const close = openModal(body, { onClose: () => { renderHud(); saveRun(); api.resumeWorldMusic(); } });
  const render = () => {
    body.innerHTML = '';
    add(body, h('div', { class: 'title' }, h('h2', { class: 'grow' }, poi.name),
      h('span', {}, h('img', { src: url('Items/Object/MoneyBag.png'), class: 'icon', style: { width: '20px', verticalAlign: 'middle' } }), ` ${G.gold}`),
      button('✕', () => close(), 'small')));
    add(body, h('div', { class: 'tabs' },
      ['inn', 'tavern', 'market', 'sell'].map((t) => button({ inn: 'Inn', tavern: 'Tavern', market: 'Market', sell: 'Sell' }[t], () => { tab = t; render(); }, `small ${tab === t ? 'pressed' : ''}`))));
    if (tab === 'inn') {
      const hurt = G.party.filter((u) => u.hp < maxHp(u));
      const cost = Math.max(0, hurt.length * (3 + stock.tier * 2));
      add(body, h('div', { class: 'dialog-text' }, 'A warm hearth, a hot meal, and a real bed. Your companions rest and recover.'),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          button(hurt.length ? `Rest (${cost} gold)` : 'Everyone is healthy', () => {
            if (G.gold < cost) { toast('Not enough gold'); return; }
            G.gold -= cost; for (const u of G.party) u.hp = maxHp(u); G.steps += 10; sfx('heal', 0.7); toast('Fully rested'); render(); renderHud();
          }, '', !hurt.length || G.gold < cost)),
        h('div', { class: 'sep' }),
        h('div', { class: 'small dim' }, 'Supplies'),
        ['potion', 'medipack'].map((id) => {
          const c = CONSUMABLES[id];
          return itemCard(makeConsumable(id), [button(`${c.price}g`, () => {
            if (G.gold < c.price || G.bag.length >= MAX_BAG) { toast(G.bag.length >= MAX_BAG ? 'Bag is full' : 'Not enough gold'); return; }
            G.gold -= c.price; G.bag.push(makeConsumable(id)); sfx('coin', 0.6); render();
          }, 'small', G.gold < c.price)]);
        }));
    }
    if (tab === 'tavern') {
      add(body, h('div', { class: 'dim small' }, `Fighters looking for work. Party ${G.party.length}/${MAX_PARTY}. New faces arrive every few days.`));
      if (!stock.recruits.length) add(body, h('div', { class: 'dim' }, 'The tavern is empty tonight.'));
      for (const r of stock.recruits) {
        const bg = BACKGROUNDS[r.bg];
        add(body, h('div', { class: 'card panel inset', style: { alignItems: 'flex-start' } },
          faceImg(spriteOf(r), 'sm'),
          h('div', { class: 'info' },
            h('div', {}, `${r.name} `, h('span', { class: 'dim small' }, `Lv ${r.level} ${bg.label}`)),
            unitStatLine(r),
            h('div', { class: `small tname t${r.weapon.tier}` }, itemName(r.weapon)),
            r.gear ? h('div', { class: `small tname t${r.gear.tier}` }, itemName(r.gear)) : null,
            h('div', { class: 'small dim' }, `"${r.quirk}"`)),
          button(`${r.cost}g`, () => {
            if (G.party.length >= MAX_PARTY) { toast('Party is full'); return; }
            if (G.gold < r.cost) { toast('Not enough gold'); return; }
            G.gold -= r.cost; G.party.push(r); stock.recruits = stock.recruits.filter((x) => x !== r);
            sfx('levelup', 0.6); toast(`${r.name} joins you!`); render(); renderHud();
          }, 'small', G.gold < r.cost || G.party.length >= MAX_PARTY)));
      }
    }
    if (tab === 'market') {
      if (!stock.items.length) add(body, h('div', { class: 'dim' }, 'Sold out. Come back in a few days.'));
      for (const it of stock.items) {
        const price = itemValue(it);
        add(body, itemCard(it, [button(`${price}g`, () => {
          if (G.gold < price) { toast('Not enough gold'); return; }
          if (G.bag.length >= MAX_BAG) { toast('Bag is full'); return; }
          G.gold -= price; G.bag.push(it); stock.items = stock.items.filter((x) => x !== it); sfx('coin', 0.6); render();
        }, 'small', G.gold < price)]));
      }
    }
    if (tab === 'sell') {
      if (!G.bag.length) add(body, h('div', { class: 'dim' }, 'Nothing in your bag to sell. (Unequip items from the Party screen to sell them.)'));
      for (const it of G.bag) {
        const price = Math.round(itemValue(it) * 0.45);
        add(body, itemCard(it, [button(`Sell ${price}g`, () => {
          G.gold += price; G.bag = G.bag.filter((x) => x !== it); sfx('coin', 0.6); render();
        }, 'small')]));
      }
    }
  };
  render();
}

function showMerchant(onDone) {
  const tier = tierAt(G.player.x, G.player.y, G.world.start, G.world.biome[G.player.y * G.world.W + G.player.x]);
  const items = [randomLoot(Math.min(5, tier + 1)), randomLoot(tier), makeConsumable('potion')];
  const body = h('div');
  const close = openModal(body, { onClose: () => { renderHud(); saveRun(); if (onDone) onDone(); } });
  const render = () => {
    body.innerHTML = '';
    add(body, h('div', { class: 'title' }, h('h2', { class: 'grow' }, 'Traveling Merchant'), h('span', {}, `${G.gold}g`), button('✕', () => close(), 'small')));
    for (const it of items) {
      const price = Math.round(itemValue(it) * 1.15);
      add(body, itemCard(it, [button(`${price}g`, () => {
        if (G.gold < price || G.bag.length >= MAX_BAG) { toast(G.bag.length >= MAX_BAG ? 'Bag is full' : 'Not enough gold'); return; }
        G.gold -= price; G.bag.push(it); items.splice(items.indexOf(it), 1); sfx('coin', 0.6); render();
      }, 'small', G.gold < price)]));
    }
  };
  render();
}

// ------------------------------------------------------------------ Battle bar
export function renderBattleBar(s) {
  const bar = bottomBar();
  bar.innerHTML = '';
  const existing = document.querySelector('.forecast');
  if (existing) existing.remove();
  if (s.phase !== 'player') { add(bar, h('div', { class: 'panel' }, 'Enemy turn...')); return; }

  if (s.state === 'forecast' && s.sel && s.fTarget) {
    const panel = h('div', { class: 'forecast panel' });
    const A = s.sel, D = s.fTarget;
    if (s.fHeal) {
      add(panel, h('div', { class: 'vs' },
        unitMini(A), h('div', { class: 'center good' }, `Heal +${s.healAmount}`), unitMini(D)));
    } else {
      const f = s.forecast;
      const line = (x) => (x ? `${x.dmg}${x.strikes > 1 ? '×2' : ''} dmg · ${x.hit}% hit · ${x.crit}% crit` : 'No counter');
      add(panel, h('div', { class: 'vs' },
        unitMini(A), h('div', { class: 'center' }, '⚔'), unitMini(D)),
        h('div', { class: 'small', style: { marginTop: '4px' } }, h('span', { class: 'good' }, 'You: '), line(f)),
        h('div', { class: 'small' }, h('span', { class: 'bad' }, 'Counter: '), line(f.counter)),
        f.dmg * f.strikes >= D.u.hp ? h('div', { class: 'small', style: { color: '#ffd27a' } }, 'Can defeat on hit!') : null);
    }
    root.appendChild(panel);
    add(bar, button(s.fHeal ? 'Heal' : 'Attack', s.onConfirm), button('Cancel', s.onCancel));
    return;
  }
  if (s.inspect && !s.sel) {
    const panel = h('div', { class: 'forecast panel' }, unitInfo(s.inspect));
    root.appendChild(panel);
  }
  if (s.state === 'selected' && s.sel) {
    root.appendChild(h('div', { class: 'forecast panel' }, unitInfo(s.sel)));
    add(bar, button('Wait here', s.onWait), button('Cancel', s.onDeselect));
    return;
  }
  if (s.state === 'action' && s.sel) {
    root.appendChild(h('div', { class: 'forecast panel small center' }, 'Tap a red foe to attack' + (stats(s.sel.u).heals ? ', or a green ally to heal' : '') + '.'));
    add(bar, button('Wait', s.onWait), s.canUndo ? button('Undo move', s.onUndo) : null);
    return;
  }
  if (s.state === 'busy') return;
  add(bar, h('div', { class: 'panel small' }, `Turn ${s.turn}`), button('End turn', s.onEndTurn), button('Retreat', s.onRetreat));
}

function unitMini(b) {
  return h('div', { class: 'row', style: { gap: '4px' } }, faceImg(b.sprite, 'sm'),
    h('div', { class: 'small' }, h('div', {}, b.u.name), h('div', { class: 'dim' }, `HP ${b.u.hp}/${maxHp(b.u)}`)));
}
function unitInfo(b) {
  const u = b.u;
  return h('div', {},
    h('div', { class: 'row' }, faceImg(b.sprite, 'sm'),
      h('div', { class: 'grow' },
        h('div', {}, `${u.hero ? '★ ' : ''}${u.name} `, h('span', { class: 'dim small' }, `Lv ${u.level}${u.bg && !u.monster ? ' ' + BACKGROUNDS[u.bg].label : ''}`)),
        hpBar(u))),
    unitStatLine(u),
    u.weapon ? h('div', { class: `small tname t${u.weapon.tier}` }, itemName(u.weapon)) : null,
    b.team === 'enemy' ? h('div', { class: 'small dim' }, 'Shaded tiles: where it can move and strike.') : null);
}

// ------------------------------------------------------------------ Victory / death
export function showVictory({ gold, results, fallen, tier, elite, lootBonus, name }) {
  G.gold += gold;
  const loot = [];
  const lootChance = 0.4 + tier * 0.06;
  const nLoot = (elite ? 2 : 0) + (rand.chance(lootChance) ? 1 : 0) + (lootBonus && rand.chance(0.5) ? 1 : 0);
  for (let i = 0; i < nLoot; i++) loot.push(randomLoot(Math.max(1, Math.min(5, tier + (elite ? 1 : 0) - (rand.chance(0.35) ? 1 : 0)))));
  for (const it of loot) addToBag(it);
  if (results.some((r) => r.lvl)) sfx('jingle_levelup', 0.7);
  api.returnToWorld();
  openModal(h('div', { class: 'col' },
    h('h2', {}, 'Victory!'),
    h('div', {}, h('img', { src: url('Items/Object/MoneyBag.png'), style: { width: '20px', verticalAlign: 'middle' } }), ` +${gold} gold`),
    results.map((r) => h('div', { class: 'row' }, faceImg(spriteOf(r.u), 'sm'),
      h('div', { class: 'grow' }, h('div', {}, `${r.u.name} +${r.xp} XP`),
        r.lvl ? h('div', { class: 'good small' }, `Level ${r.lvl.level}! +${r.lvl.g.hp} HP +${r.lvl.g.atk} ATK${r.lvl.g.def ? ` +${r.lvl.g.def} DEF` : ''}`) : xpBar(r.u)))),
    fallen.length ? h('div', { class: 'bad' }, `Fallen: ${fallen.map((u) => u.name).join(', ')}`) : null,
    loot.length ? h('div', {}, h('div', { class: 'small dim' }, 'Spoils (added to bag)'), loot.map((it) => itemCard(it))) : null,
    button('Continue', () => closeAllModals())), { onClose: () => { renderHud(); saveRun(); } });
}

export function showDeath({ cause, fallen }) {
  const hr = hero();
  G.scene = 'dead';
  closeAllModals();
  clearHud();
  sfx('gameover', 0.8);
  playMusic('death');
  const summary = {
    name: hr ? hr.name : '?', bg: hr && BACKGROUNDS[hr.bg] ? BACKGROUNDS[hr.bg].label : '', day: day(), kills: G.stats.kills,
    battles: G.stats.battles, cause, level: hr ? hr.level : 1, when: Date.now(),
  };
  recordDeath(summary);
  eraseRun();
  const companions = G.stats.fallen.filter((f) => !hr || f.name !== hr.name);
  openModal(h('div', { class: 'col center' },
    h('h1', {}, 'Your journey ends'),
    hr ? faceImg(spriteOf(hr)) : null,
    h('div', {}, `${summary.name} the ${summary.bg}, level ${summary.level}`),
    h('div', { class: 'dim' }, cause),
    h('div', { class: 'statline', style: { justifyContent: 'center' } },
      h('span', {}, 'Days ', h('b', {}, summary.day)), h('span', {}, 'Battles ', h('b', {}, summary.battles)),
      h('span', {}, 'Kills ', h('b', {}, summary.kills)), h('span', {}, 'Gold ', h('b', {}, G.gold))),
    companions.length ? h('div', { class: 'small dim' }, `Fallen companions: ${companions.map((f) => f.name).join(', ')}`) : null,
    G.party.filter((u) => !u.hero && u.alive).length ? h('div', { class: 'small dim' }, `Scattered to the winds: ${G.party.filter((u) => !u.hero && u.alive).map((u) => u.name).join(', ')}`) : null,
    button('Begin anew', () => { closeAllModals(); api.toTitle(); })), { dismissable: false });
}
