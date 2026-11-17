// Image cache + audio manager.

const A = 'assets/';
const images = new Map();

export function img(path) {
  let im = images.get(path);
  if (!im) {
    im = new Image();
    im.src = A + path;
    images.set(path, im);
  }
  return im;
}

export function ready(im) { return im.complete && im.naturalWidth > 0; }

export function preload(paths) {
  return Promise.all(paths.map((p) => new Promise((res) => {
    const im = img(p);
    if (ready(im)) return res();
    im.addEventListener('load', res, { once: true });
    im.addEventListener('error', () => { console.warn('missing', p); res(); }, { once: true });
  })));
}

export const url = (path) => A + path;

// ---------- Audio ----------
const sfxCache = new Map();
let music = null, musicName = null;
export const audio = {
  musicOn: true,
  sfxOn: true,
  unlocked: false,
  musicVolume: 0.45,
  sfxVolume: 0.6,
};

try {
  const s = JSON.parse(localStorage.getItem('ar_audio') || '{}');
  if (typeof s.musicOn === 'boolean') audio.musicOn = s.musicOn;
  if (typeof s.sfxOn === 'boolean') audio.sfxOn = s.sfxOn;
} catch (e) { /* storage unavailable */ }

function saveAudioPrefs() {
  try { localStorage.setItem('ar_audio', JSON.stringify({ musicOn: audio.musicOn, sfxOn: audio.sfxOn })); } catch (e) {}
}

export function sfx(name, vol = 1) {
  if (!audio.sfxOn || !audio.unlocked) return;
  let base = sfxCache.get(name);
  if (!base) { base = new Audio(`${A}audio/sfx/${name}.mp3`); base.preload = 'auto'; sfxCache.set(name, base); }
  try {
    const a = base.cloneNode();
    a.volume = Math.min(1, audio.sfxVolume * vol);
    a.play().catch(() => {});
  } catch (e) {}
}

export function playMusic(name) {
  if (musicName === name && music) {
    if (audio.musicOn && audio.unlocked && music.paused) music.play().catch(() => {});
    return;
  }
  if (music) { music.pause(); }
  musicName = name;
  music = new Audio(`${A}audio/music/${name}.mp3`);
  music.loop = true;
  music.volume = audio.musicVolume;
  if (audio.musicOn && audio.unlocked) music.play().catch(() => {});
}

export function unlockAudio() {
  if (audio.unlocked) return;
  audio.unlocked = true;
  if (music && audio.musicOn) music.play().catch(() => {});
}

export function toggleMusic() {
  audio.musicOn = !audio.musicOn;
  if (music) { if (audio.musicOn) music.play().catch(() => {}); else music.pause(); }
  saveAudioPrefs();
}
export function toggleSfx() { audio.sfxOn = !audio.sfxOn; saveAudioPrefs(); }
