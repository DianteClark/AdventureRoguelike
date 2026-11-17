// Tileset coordinates (in 16px tiles) and autotiling.
import { img } from './assets.js';

export const SHEETS = {
  floor: 'Backgrounds/Tilesets/TilesetFloor.png',
  water: 'Backgrounds/Tilesets/TilesetWater.png',
  nature: 'Backgrounds/Tilesets/TilesetNature.png',
  house: 'Backgrounds/Tilesets/TilesetHouse.png',
  towers: 'Backgrounds/Tilesets/TilesetTowers.png',
  element: 'Backgrounds/Tilesets/TilesetElement.png',
};

export const BIOME = { GRASS: 0, SAND: 1, SNOW: 2 };
export const BIOME_CODE = ['g', 'd', 's'];
export const BIOME_NAME = ['Greenlands', 'Ember Dunes', 'Frostreach'];

export const TERR = { GROUND: 0, WATER: 1, ROAD: 2 };

// Ground fill tiles per biome (first entry is the plain tile, others are detail variants)
export const GROUND = [
  [[0, 12], [1, 12], [2, 12], [3, 12], [4, 12]],
  [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5]],
  [[0, 19], [1, 19], [2, 19], [3, 19], [4, 19]],
];
// Origins of 16-tile "patch" sets
export const ROAD_SET = [[0, 7], [0, 0], [0, 14]];   // in floor sheet
export const WATER_SET = [[0, 6], [0, 0], [13, 0]];  // in water sheet

// mask bits: N=1 E=2 S=4 W=8  ->  offset in the 4x4 patch set
const MASK = {
  15: [1, 1], 14: [1, 0], 11: [1, 2], 13: [2, 1], 7: [0, 1],
  6: [0, 0], 12: [2, 0], 3: [0, 2], 9: [2, 2],
  5: [3, 1], 4: [3, 0], 1: [3, 2],
  10: [1, 3], 2: [0, 3], 8: [2, 3], 0: [3, 3],
};
export function patchTile(origin, n, e, s, w) {
  const m = MASK[(n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0)];
  return [origin[0] + m[0], origin[1] + m[1]];
}

// ---------------------------------------------------------------- Static objects
// sheet, sx, sy (tiles), w, h (tiles). Drawn bottom-centered on their tile.
// block: impassable. cover: dodge bonus in battle. decal: flat (drawn into ground layer).
export const OBJECTS = [];
const def = (key, o) => { o.key = key; o.index = OBJECTS.length; OBJECTS.push(o); return o.index; };

export const OBJ = {
  // trees
  treePine: def('treePine', { sheet: 'nature', sx: 0, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treeDark: def('treeDark', { sheet: 'nature', sx: 2, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treeRound: def('treeRound', { sheet: 'nature', sx: 16, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treeRound2: def('treeRound2', { sheet: 'nature', sx: 18, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treeRoots: def('treeRoots', { sheet: 'nature', sx: 6, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treeDead: def('treeDead', { sheet: 'nature', sx: 4, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treeSnow1: def('treeSnow1', { sheet: 'nature', sx: 8, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treeSnow2: def('treeSnow2', { sheet: 'nature', sx: 10, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treeSnow3: def('treeSnow3', { sheet: 'nature', sx: 12, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  treePink: def('treePink', { sheet: 'nature', sx: 14, sy: 0, w: 2, h: 2, block: true, kind: 'tree' }),
  // boulders
  rockGrey: def('rockGrey', { sheet: 'nature', sx: 15, sy: 14, w: 2, h: 2, block: true, kind: 'rock' }),
  rockGrey2: def('rockGrey2', { sheet: 'nature', sx: 15, sy: 16, w: 2, h: 2, block: true, kind: 'rock' }),
  rockBrown: def('rockBrown', { sheet: 'nature', sx: 15, sy: 10, w: 2, h: 2, block: true, kind: 'rock' }),
  rockBrown2: def('rockBrown2', { sheet: 'nature', sx: 15, sy: 12, w: 2, h: 2, block: true, kind: 'rock' }),
  rockSnow: def('rockSnow', { sheet: 'nature', sx: 2, sy: 12, w: 2, h: 2, block: true, kind: 'rock' }),
  rockBlue: def('rockBlue', { sheet: 'nature', sx: 0, sy: 12, w: 2, h: 2, block: true, kind: 'rock' }),
  // small rocks (block)
  stoneGrey: def('stoneGrey', { sheet: 'nature', sx: 17, sy: 17, w: 1, h: 1, block: true, kind: 'rock' }),
  stoneGrey2: def('stoneGrey2', { sheet: 'nature', sx: 18, sy: 17, w: 1, h: 1, block: true, kind: 'rock' }),
  stoneBrown: def('stoneBrown', { sheet: 'nature', sx: 17, sy: 13, w: 1, h: 1, block: true, kind: 'rock' }),
  stoneBrown2: def('stoneBrown2', { sheet: 'nature', sx: 18, sy: 13, w: 1, h: 1, block: true, kind: 'rock' }),
  stoneSnow: def('stoneSnow', { sheet: 'nature', sx: 9, sy: 12, w: 1, h: 1, block: true, kind: 'rock' }),
  stoneTeal: def('stoneTeal', { sheet: 'nature', sx: 6, sy: 12, w: 1, h: 1, block: true, kind: 'rock' }),
  // bushes = cover
  bush1: def('bush1', { sheet: 'nature', sx: 0, sy: 10, w: 1, h: 1, cover: true, kind: 'bush' }),
  bush2: def('bush2', { sheet: 'nature', sx: 1, sy: 10, w: 1, h: 1, cover: true, kind: 'bush' }),
  bush3: def('bush3', { sheet: 'nature', sx: 3, sy: 10, w: 1, h: 1, cover: true, kind: 'bush' }),
  bush4: def('bush4', { sheet: 'nature', sx: 7, sy: 10, w: 1, h: 1, cover: true, kind: 'bush' }),
  bushOrange: def('bushOrange', { sheet: 'nature', sx: 5, sy: 13, w: 1, h: 1, cover: true, kind: 'bush' }),
  bushOrange2: def('bushOrange2', { sheet: 'nature', sx: 6, sy: 13, w: 1, h: 1, cover: true, kind: 'bush' }),
  bushSnow: def('bushSnow', { sheet: 'nature', sx: 10, sy: 12, w: 1, h: 1, cover: true, kind: 'bush' }),
  bushSnow2: def('bushSnow2', { sheet: 'nature', sx: 5, sy: 12, w: 1, h: 1, cover: true, kind: 'bush' }),
  // flat decals
  flower1: def('flower1', { sheet: 'nature', sx: 0, sy: 11, w: 1, h: 1, decal: true }),
  flower2: def('flower2', { sheet: 'nature', sx: 1, sy: 11, w: 1, h: 1, decal: true }),
  flower3: def('flower3', { sheet: 'nature', sx: 2, sy: 11, w: 1, h: 1, decal: true }),
  flower4: def('flower4', { sheet: 'nature', sx: 3, sy: 11, w: 1, h: 1, decal: true }),
  pebbles: def('pebbles', { sheet: 'nature', sx: 15, sy: 18, w: 1, h: 1, decal: true }),
  pebbles2: def('pebbles2', { sheet: 'nature', sx: 16, sy: 18, w: 1, h: 1, decal: true }),
};

export const BIOME_OBJ = [
  { // grass
    trees: [OBJ.treePine, OBJ.treeDark, OBJ.treeRound, OBJ.treeRound2, OBJ.treeRoots, OBJ.treePink],
    rocks: [OBJ.rockGrey, OBJ.rockGrey2], stones: [OBJ.stoneGrey, OBJ.stoneGrey2],
    bushes: [OBJ.bush1, OBJ.bush2, OBJ.bush3, OBJ.bush4], decals: [OBJ.flower1, OBJ.flower2, OBJ.flower3, OBJ.flower4],
  },
  { // sand
    trees: [OBJ.treeDead],
    rocks: [OBJ.rockBrown, OBJ.rockBrown2], stones: [OBJ.stoneBrown, OBJ.stoneBrown2],
    bushes: [OBJ.bushOrange, OBJ.bushOrange2], decals: [OBJ.pebbles, OBJ.pebbles2],
  },
  { // snow
    trees: [OBJ.treeSnow1, OBJ.treeSnow2, OBJ.treeSnow3],
    rocks: [OBJ.rockSnow, OBJ.rockBlue], stones: [OBJ.stoneSnow, OBJ.stoneTeal],
    bushes: [OBJ.bushSnow, OBJ.bushSnow2], decals: [],
  },
];

// ---------------------------------------------------------------- Point-of-interest art
// ax/ay: which tile of the sprite stands on the POI tile (the "door").
export const POI_ART = {
  house1: { sheet: 'house', sx: 0, sy: 0, w: 4, h: 3, ax: 1, ay: 2 },
  house2: { sheet: 'house', sx: 4, sy: 0, w: 4, h: 3, ax: 1, ay: 2 },
  house3: { sheet: 'house', sx: 8, sy: 0, w: 4, h: 3, ax: 1, ay: 2 },
  house4: { sheet: 'house', sx: 12, sy: 0, w: 4, h: 3, ax: 1, ay: 2 },
  tent: { sheet: 'house', sx: 0, sy: 7, w: 3, h: 3, ax: 1, ay: 2 },
  hut: { sheet: 'house', sx: 3, sy: 7, w: 3, h: 3, ax: 1, ay: 2 },
  igloo1: { sheet: 'house', sx: 0, sy: 11, w: 3, h: 3, ax: 1, ay: 2 },
  igloo2: { sheet: 'house', sx: 3, sy: 11, w: 3, h: 3, ax: 1, ay: 2 },
  torii: { sheet: 'house', sx: 0, sy: 5, w: 3, h: 2, ax: 1, ay: 1 },
  statueOrb: { sheet: 'house', sx: 3, sy: 15, w: 2, h: 2, ax: 0, ay: 1 },
  statueSit: { sheet: 'house', sx: 5, sy: 15, w: 2, h: 2, ax: 0, ay: 1 },
  denWood: { sheet: 'towers', sx: 0, sy: 0, w: 2, h: 2, ax: 0, ay: 1 },
  denRuin: { sheet: 'towers', sx: 4, sy: 0, w: 2, h: 2, ax: 0, ay: 1 },
  denStone: { sheet: 'towers', sx: 0, sy: 2, w: 2, h: 2, ax: 0, ay: 1 },
  denHut: { sheet: 'towers', sx: 12, sy: 0, w: 2, h: 2, ax: 0, ay: 1 },
  denDome: { sheet: 'towers', sx: 18, sy: 0, w: 2, h: 2, ax: 0, ay: 1 },
  denRed: { sheet: 'towers', sx: 18, sy: 2, w: 2, h: 2, ax: 0, ay: 1 },
  denCrystal: { sheet: 'towers', sx: 18, sy: 4, w: 2, h: 2, ax: 0, ay: 1 },
};

export const sheet = (key) => img(SHEETS[key]);
