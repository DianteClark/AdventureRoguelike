// Run state + persistence. A run is one life: when the hero falls the save is erased.

export const G = {
  scene: 'title',        // title | world | battle | dead
  world: null,           // generated world
  ground: null,          // pre-rendered ground canvas
  party: [],             // units (hero first)
  bag: [],               // spare items
  gold: 0,
  steps: 0,
  player: { x: 0, y: 0, rx: 0, ry: 0, dir: 0, moving: 0 },
  stats: { battles: 0, kills: 0, villages: 0, chests: 0, events: 0, fallen: [] },
  flags: {},
  battle: null,
  busy: false,           // blocks input during modals/animations
  runId: null,
};

export const MAX_PARTY = 6;
export const MAX_BAG = 16;
export const day = () => Math.floor(G.steps / 40) + 1;
export const hero = () => G.party.find((u) => u.hero);

const SAVE_KEY = 'ar_run_v1';

function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
function unb64(s, Type = Uint8Array) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return Type === Uint8Array ? u : new Type(u.buffer); }

export function saveRun() {
  if (!G.world || G.scene === 'dead') return;
  try {
    const w = G.world;
    const data = {
      v: 1, runId: G.runId,
      world: {
        seed: w.seed, W: w.W, H: w.H, start: w.start,
        biome: b64(w.biome), terr: b64(w.terr), variant: b64(w.variant), obj: b64(new Uint8Array(w.obj.buffer)),
        explored: b64(w.explored), reach: b64(w.reach), pois: w.pois, enemies: w.enemies,
      },
      party: G.party, bag: G.bag, gold: G.gold, steps: G.steps,
      player: { x: G.player.x, y: G.player.y, dir: G.player.dir },
      stats: G.stats, flags: G.flags,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { console.warn('save failed', e); }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function loadRun() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d || d.v !== 1) return false;
    const w = d.world;
    G.world = {
      seed: w.seed, W: w.W, H: w.H, start: w.start,
      biome: unb64(w.biome), terr: unb64(w.terr), variant: unb64(w.variant), obj: unb64(w.obj, Int16Array),
      explored: unb64(w.explored), reach: unb64(w.reach), pois: w.pois, enemies: w.enemies,
    };
    G.party = d.party; G.bag = d.bag; G.gold = d.gold; G.steps = d.steps;
    G.player = { ...d.player, rx: d.player.x * 16, ry: d.player.y * 16, moving: 0 };
    G.stats = d.stats; G.flags = d.flags || {}; G.runId = d.runId;
    return true;
  } catch (e) { console.warn('load failed', e); return false; }
}

export function eraseRun() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

// Graveyard of past runs (for the title screen)
export function recordDeath(summary) {
  try {
    const list = JSON.parse(localStorage.getItem('ar_graves') || '[]');
    list.unshift(summary);
    localStorage.setItem('ar_graves', JSON.stringify(list.slice(0, 10)));
  } catch (e) {}
}
export function graves() { try { return JSON.parse(localStorage.getItem('ar_graves') || '[]'); } catch (e) { return []; } }

// ---------------------------------------------------------------- Renown (meta progression across runs)
export const UNLOCKS = [
  { at: 40, id: 'purse', name: 'Coin Purse', desc: 'Start with +40 gold' },
  { at: 120, id: 'kit', name: 'Veteran Kit', desc: 'Start with an Iron weapon' },
  { at: 220, id: 'friend', name: 'Old Friend', desc: 'Start with a companion' },
  { at: 350, id: 'choice', name: 'Wide Road', desc: 'Choose from 4 heroes instead of 3' },
  { at: 500, id: 'blessed', name: 'Blessed Blood', desc: 'Your hero starts with +6 max HP' },
  { at: 750, id: 'map', name: 'Treasure Map', desc: 'Lairs and Guardians are marked from the start' },
];
export function renown() { try { return +(localStorage.getItem('ar_renown') || 0); } catch (e) { return 0; } }
export function addRenown(n) { try { localStorage.setItem('ar_renown', String(renown() + n)); } catch (e) {} }
export const unlocked = (id) => { const u = UNLOCKS.find((x) => x.id === id); return u && renown() >= u.at; };
export function runRenown(legend = false) {
  const h = G.party.find((u) => u.hero);
  return Math.round(G.stats.kills * 1 + G.stats.battles * 2 + day() * 3 + (G.flags.guardians || 0) * 60 + (legend ? 250 : 0) + (h ? h.level * 5 : 0));
}
