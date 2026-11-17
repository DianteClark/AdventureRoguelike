// Static game data: sprites, monsters, weapons, gear, traits, backgrounds, names.

export const TILE = 16;

// ---------------------------------------------------------------- Sprites
// Character sheets: 4 columns (down, up, left, right) x 7 rows (rows 0-3 walk, row 4 attack).
// Monster sheets:  4 columns (down, up, left, right) x 4 rows of animation frames.
export const charSheet = (name) => `Actor/Character/${name}/SpriteSheet.png`;
export const charFace = (name) => `Actor/Character/${name}/Faceset.png`;

const MONSTER_FILE = {
  Beast: 'Beast.png', Beast2: 'Beast2.png', Eye: 'Eye.png', Eye2: 'Eye2.png', Larva: 'Larva.png', Larva2: 'Larva2.png',
  Lizard: 'Lizard.png', Lizard2: 'Lizard2.png', Mole: 'Mole.png', Mole2: 'Mole2.png', Mollusc: 'Mollusc.png',
  Mollusc2: 'Mollusc2.png', Mushroom: 'mushroom.png', Mushroom2: 'mushroom2.png', Owl: 'Owl.png', Owl2: 'Owl2.png',
  Reptile: 'Reptile.png', Reptile2: 'Reptile2.png', Slime: 'Slime.png', Slime2: 'Slime2.png', Slime3: 'Slime3.png',
  Slime4: 'Slime4.png', Snake: 'Snake.png', Snake2: 'Snake2.png', Snake3: 'Snake3.png', Snake4: 'Snake4.png',
};
export const monsterSheet = (name) => `Actor/Monster/${name}/${MONSTER_FILE[name] || 'SpriteSheet.png'}`;
export const monsterFace = (name) => `Actor/Monster/${name}/Faceset.png`;

export function spritePaths(sprite) {
  return sprite.kind === 'monster'
    ? { sheet: monsterSheet(sprite.name), face: monsterFace(sprite.name) }
    : { sheet: charSheet(sprite.name), face: charFace(sprite.name) };
}

// ---------------------------------------------------------------- Tiers
export const TIERS = [
  null,
  { name: 'Rusty', color: '#c8c8c8', price: 1 },
  { name: 'Iron', color: '#7fd46a', price: 2.2 },
  { name: 'Steel', color: '#5fb4ff', price: 4 },
  { name: 'Masterwork', color: '#c58bff', price: 7 },
  { name: 'Legendary', color: '#ffc23d', price: 12 },
];
export const GEAR_TIER_NAMES = [null, 'Worn', 'Sturdy', 'Fine', 'Masterwork', 'Legendary'];

// ---------------------------------------------------------------- Weapon families
// Each family plays differently on the grid.
export const FAMILIES = {
  blade:   { label: 'Blade',   range: [1, 1], power: 0, acc: 5,   crit: 5, desc: 'Reliable melee. Bonus accuracy and crit.' },
  dagger:  { label: 'Dagger',  range: [1, 1], power: -2, acc: 10, crit: 10, twin: true, desc: 'Strikes twice at reduced power.' },
  heavy:   { label: 'Heavy',   range: [1, 1], power: 3, acc: -10, crit: 0, sunder: 2, desc: 'Big hits that ignore 2 defense. Less accurate.' },
  polearm: { label: 'Polearm', range: [1, 1], power: 1, acc: 0,   crit: 0, pierce: true, desc: 'Also hits the enemy standing behind the target.' },
  bow:     { label: 'Bow',     range: [2, 3], power: 0, acc: 0,   crit: 5, desc: 'Ranged 2-3. Cannot strike adjacent foes.' },
  whip:    { label: 'Whip',    range: [1, 2], power: -1, acc: 0,  crit: 5, desc: 'Reaches 1-2 tiles.' },
  staff:   { label: 'Staff',   range: [1, 2], power: 0, acc: 5,   crit: 0, magic: true, desc: 'Magic 1-2 range. Ignores half of defense.' },
  tome:    { label: 'Tome',    range: [1, 2], power: -2, acc: 5,  crit: 0, magic: true, heals: true, desc: 'Weak magic, but can heal allies 1-2 tiles away.' },
};

export const WEAPONS = [
  { id: 'Sword', name: 'Sword', family: 'blade' },
  { id: 'Sword2', name: 'Broadsword', family: 'blade', mods: { power: 1, acc: -5 } },
  { id: 'Katana', name: 'Katana', family: 'blade', mods: { crit: 8 } },
  { id: 'Rapier', name: 'Rapier', family: 'blade', mods: { acc: 10, power: -1 } },
  { id: 'Ninjaku', name: 'Ninjaku', family: 'dagger' },
  { id: 'Sai', name: 'Sai', family: 'dagger', mods: { crit: 5 } },
  { id: 'Axe', name: 'Axe', family: 'heavy' },
  { id: 'Hammer', name: 'Warhammer', family: 'heavy', mods: { power: 1, acc: -5 } },
  { id: 'Club', name: 'Club', family: 'heavy', mods: { power: -1, acc: 5 } },
  { id: 'BigSword', name: 'Greatsword', family: 'heavy', mods: { power: 2, acc: -5 } },
  { id: 'Lance', name: 'Spear', family: 'polearm' },
  { id: 'Lance2', name: 'Halberd', family: 'polearm', mods: { power: 1, acc: -5 } },
  { id: 'Bow', name: 'Shortbow', family: 'bow' },
  { id: 'Bow2', name: 'Longbow', family: 'bow', mods: { power: 1, acc: -5 } },
  { id: 'Whip', name: 'Whip', family: 'whip' },
  { id: 'MagicWand', name: 'Wand', family: 'staff' },
  { id: 'Stick', name: 'Staff', family: 'staff', mods: { power: 1, acc: -5 } },
  { id: 'Book', name: 'Tome', family: 'tome' },
  // humble tools — farmers start with these
  { id: 'Pickaxe', name: 'Pickaxe', family: 'heavy', mods: { power: -2 }, tool: true },
  { id: 'Fork', name: 'Pitchfork', family: 'polearm', mods: { power: -2 }, tool: true },
  { id: 'AxeTool', name: 'Hatchet', family: 'heavy', mods: { power: -2 }, tool: true },
  { id: 'Bone', name: 'Bone Club', family: 'heavy', mods: { power: -1 }, tool: true },
];
export const weaponIcon = (id) => `Items/Weapons/${id}/Sprite.png`;
export const weaponBase = (id) => WEAPONS.find((w) => w.id === id);

// Base power per tier
export const TIER_POWER = [0, 3, 5, 7, 10, 13];

// ---------------------------------------------------------------- Gear (second slot)
const SI = 'Ui/Skill Icon/Items & Weapon/';
export const GEAR = [
  { id: 'Armor', name: 'Armor', icon: SI + 'Armor.png', per: { def: 1, hp: 2 } },
  { id: 'Helmet', name: 'Helm', icon: SI + 'Helmet.png', per: { def: 1, hp: 1 } },
  { id: 'Guard', name: 'Bracers', icon: SI + 'Guard.png', per: { def: 1, acc: 2 } },
  { id: 'Boot', name: 'Boots', icon: SI + 'Boot.png', per: { dodge: 4 }, flat: { mov: 0 } },
  { id: 'Ring', name: 'Ring', icon: SI + 'Ring.png', per: { crit: 3, acc: 3 } },
  { id: 'Amulet', name: 'Amulet', icon: SI + 'Amulet.png', per: { hp: 4 } },
];
export const gearBase = (id) => GEAR.find((g) => g.id === id);

// ---------------------------------------------------------------- Traits (rolled on tier 2+)
// pre: name prefix, suf: name suffix. eff: stat bonuses or special flags.
export const WEAPON_TRAITS = [
  { id: 'keen', pre: 'Keen', eff: { crit: 12 }, text: '+12% crit' },
  { id: 'precise', pre: 'Precise', eff: { acc: 15 }, text: '+15 accuracy' },
  { id: 'brutal', pre: 'Brutal', eff: { power: 2 }, text: '+2 power' },
  { id: 'vampiric', pre: 'Vampiric', eff: { lifesteal: 0.3 }, text: 'Heal 30% of damage dealt' },
  { id: 'hungry', pre: 'Hungry', eff: { healOnKill: 6 }, text: 'Heal 6 on kill' },
  { id: 'rending', pre: 'Rending', eff: { sunder: 2 }, text: 'Ignore 2 defense' },
  { id: 'tengu', suf: 'of the Tengu', eff: { mov: 1 }, text: '+1 move' },
  { id: 'execution', suf: 'of Execution', eff: { execute: 0.5 }, text: '+50% damage to foes under 35% HP' },
  { id: 'wall', suf: 'of the Wall', eff: { def: 2 }, text: '+2 defense' },
  { id: 'fortune', suf: 'of Fortune', eff: { dodge: 8, gold: 0.25 }, text: '+8 dodge, +25% gold' },
  { id: 'reach', pre: 'Long', eff: { reach: 1 }, text: '+1 max range (ranged only)', ranged: true },
  { id: 'storm', suf: 'of Storms', eff: { power: 1, crit: 6 }, text: '+1 power, +6% crit' },
];

export const GEAR_TRAITS = [
  { id: 'sturdy', pre: 'Sturdy', eff: { hp: 6 }, text: '+6 max HP' },
  { id: 'stone', suf: 'of Stone', eff: { def: 2 }, text: '+2 defense' },
  { id: 'wind', suf: 'of the Wind', eff: { mov: 1 }, text: '+1 move' },
  { id: 'shadow', suf: 'of Shadows', eff: { dodge: 10 }, text: '+10 dodge' },
  { id: 'renewal', suf: 'of Renewal', eff: { regen: 2 }, text: 'Regenerate 2 HP each turn' },
  { id: 'thorned', pre: 'Thorned', eff: { thorns: 3 }, text: 'Deal 3 damage to melee attackers' },
  { id: 'phoenix', suf: 'of the Phoenix', eff: { lastStand: 1 }, text: 'Survive a lethal blow once per battle' },
  { id: 'focused', pre: 'Focused', eff: { acc: 10 }, text: '+10 accuracy' },
  { id: 'fury', suf: 'of Fury', eff: { power: 2 }, text: '+2 power' },
];

// ---------------------------------------------------------------- Consumables
export const CONSUMABLES = {
  potion: { name: 'Life Potion', icon: 'Items/Potion/LifePot.png', heal: 0.5, price: 20, text: 'Restore 50% HP to one ally.' },
  medipack: { name: 'Medicine Kit', icon: 'Items/Potion/Medipack.png', heal: 1, price: 45, text: 'Fully restore one ally.' },
};

// ---------------------------------------------------------------- Backgrounds (heroes & recruits)
export const BACKGROUNDS = {
  ronin: {
    label: 'Ronin', desc: 'A masterless swordsman. Balanced and dependable.',
    weapons: ['Sword', 'Katana', 'Sword2'], stats: { hp: 20, atk: 4, def: 2, mov: 4, acc: 0, dodge: 5, crit: 5 },
    sprites: ['Samurai', 'SamuraiBlue', 'NinjaGray', 'Knight', 'NinjaBlue', 'FighterWhite'],
  },
  brawler: {
    label: 'Brawler', desc: 'Hits hard, takes hits. Slow on their feet.',
    weapons: ['Axe', 'Club', 'Hammer'], stats: { hp: 26, atk: 5, def: 2, mov: 3, acc: 0, dodge: 0, crit: 3 },
    sprites: ['GladiatorBlue', 'RedGladiator', 'Caveman', 'Caveman2', 'MonkeyBoxerBlue', 'MonkeyBoxerRed', 'CaveLion'],
  },
  hunter: {
    label: 'Hunter', desc: 'Strikes from range. Fragile up close.',
    weapons: ['Bow', 'Bow2'], stats: { hp: 17, atk: 4, def: 1, mov: 4, acc: 5, dodge: 8, crit: 5 },
    sprites: ['Hunter', 'Cavegirl', 'Cavegirl2', 'Eskimo', 'NinjaLeaf', 'Woman'],
  },
  guard: {
    label: 'Spearman', desc: 'Polearm fighter with a sturdy guard.',
    weapons: ['Lance', 'Lance2'], stats: { hp: 22, atk: 4, def: 3, mov: 4, acc: 0, dodge: 2, crit: 3 },
    sprites: ['KnightGold', 'LionBoy', 'Knight', 'FighterRed', 'Inspector'],
  },
  shadow: {
    label: 'Shadow', desc: 'Quick ninja with twin strikes and high dodge.',
    weapons: ['Ninjaku', 'Sai'], stats: { hp: 17, atk: 4, def: 1, mov: 5, acc: 5, dodge: 14, crit: 8 },
    sprites: ['NinjaBlue2', 'NinjaDark', 'NinjaMasked', 'NinjaRed', 'NinjaYellow', 'NinjaGreen', 'NinjaRed2'],
  },
  mystic: {
    label: 'Mystic', desc: 'Casts magic that slips past armor.',
    weapons: ['MagicWand', 'Stick'], stats: { hp: 16, atk: 5, def: 1, mov: 4, acc: 5, dodge: 5, crit: 2 },
    sprites: ['NinjaMageBlack', 'NinjaMageOrange', 'SorcererBlack', 'SorcererOrange', 'Shaman', 'NinjaFire', 'NinjaThunder', 'NinjaWater'],
  },
  monk: {
    label: 'Healer', desc: 'Mends wounds from afar. Weak in a fight.',
    weapons: ['Book'], stats: { hp: 18, atk: 4, def: 2, mov: 4, acc: 5, dodge: 5, crit: 2 },
    sprites: ['Monk', 'Monk2', 'Master', 'OldMan2', 'Princess', 'ShamanLion'],
  },
  farmer: {
    label: 'Villager', desc: 'Untrained but cheap, and hardier than they look.',
    weapons: ['Pickaxe', 'Fork', 'AxeTool'], stats: { hp: 20, atk: 3, def: 1, mov: 4, acc: -5, dodge: 3, crit: 2 },
    sprites: ['Villager', 'Villager2', 'Villager3', 'Villager4', 'Villager5', 'Boy', 'Monkey'],
  },
};
export const HERO_BACKGROUNDS = ['ronin', 'brawler', 'hunter', 'guard', 'shadow', 'mystic', 'monk'];
export const HERO_SPRITE = {
  ronin: 'NinjaBlue', brawler: 'GladiatorBlue', hunter: 'Hunter', guard: 'KnightGold',
  shadow: 'NinjaRed', mystic: 'NinjaMageOrange', monk: 'Monk',
};

export const NAMES = [
  'Akio', 'Aiko', 'Benkei', 'Chiyo', 'Daichi', 'Emi', 'Fumio', 'Genji', 'Hana', 'Haru', 'Isamu', 'Jiro', 'Kaede', 'Kenta',
  'Kiyo', 'Mako', 'Mei', 'Nobu', 'Osamu', 'Rin', 'Ren', 'Saburo', 'Sora', 'Taro', 'Tomoe', 'Ume', 'Yuki', 'Yoshi',
  'Kaito', 'Nami', 'Riku', 'Shiro', 'Tsubaki', 'Hotaru', 'Goro', 'Ichiro', 'Kuma', 'Momo', 'Sen', 'Tama', 'Washi', 'Zen',
  'Asa', 'Botan', 'Chō', 'Eiji', 'Fuyu', 'Hideo', 'Iwa', 'Junko', 'Kazu', 'Masa', 'Natsu', 'Oki', 'Raiden', 'Suzu',
];

export const QUIRKS = [
  'Quiet, but never misses a meal.', 'Lost their village to the dark. Wants revenge.', 'Hums constantly. Annoying.',
  'Claims to have met a dragon. Probably lying.', 'Fiercely loyal once trusted.', 'Owes money to half the province.',
  'Afraid of birds.', 'Collects odd stones.', 'Former temple guard.', 'Ran away from an arranged marriage.',
  'Wants to see the ocean before they die.', 'Talks to their weapon.', 'Sleeps with one eye open.',
  'A gambler with terrible luck.', 'Writes bad poetry by the fire.', 'Thinks you are destined for greatness.',
];

// ---------------------------------------------------------------- Monsters
// t: threat tier (1-5). biomes: g(rass) s(now) d(esert). range: attack range. fx: hit effect.
export const MONSTERS = {
  Slime:       { label: 'Slime', t: 1, biomes: 'g', hp: 12, atk: 3, def: 0, mov: 3, range: [1, 1], fx: 'claw' },
  Slime3:      { label: 'Frost Slime', t: 1, biomes: 's', hp: 13, atk: 3, def: 1, mov: 3, range: [1, 1], fx: 'claw' },
  Slime2:      { label: 'Bog Slime', t: 2, biomes: 'g', hp: 16, atk: 4, def: 1, mov: 3, range: [1, 1], fx: 'claw' },
  Slime4:      { label: 'Acid Slime', t: 2, biomes: 'gd', hp: 15, atk: 5, def: 0, mov: 3, range: [1, 1], fx: 'claw' },
  Larva:       { label: 'Larva', t: 1, biomes: 'gd', hp: 10, atk: 3, def: 0, mov: 3, range: [1, 1], fx: 'claw' },
  Larva2:      { label: 'Ice Larva', t: 1, biomes: 's', hp: 11, atk: 3, def: 1, mov: 3, range: [1, 1], fx: 'claw' },
  Mouse:       { label: 'Rat', t: 1, biomes: 'gds', hp: 9, atk: 3, def: 0, mov: 5, range: [1, 1], fx: 'claw', dodge: 10 },
  BlueBat:     { label: 'Bat', t: 1, biomes: 'gs', hp: 9, atk: 3, def: 0, mov: 5, range: [1, 1], fx: 'claw', fly: true, dodge: 15 },
  YellowsBat:  { label: 'Dust Bat', t: 2, biomes: 'd', hp: 11, atk: 4, def: 0, mov: 5, range: [1, 1], fx: 'claw', fly: true, dodge: 15 },
  Snake:       { label: 'Snake', t: 1, biomes: 'g', hp: 11, atk: 4, def: 0, mov: 4, range: [1, 1], fx: 'claw' },
  Snake4:      { label: 'Sand Viper', t: 2, biomes: 'd', hp: 13, atk: 5, def: 1, mov: 4, range: [1, 1], fx: 'claw', crit: 10 },
  SpiderRed:   { label: 'Spider', t: 2, biomes: 'g', hp: 13, atk: 5, def: 1, mov: 5, range: [1, 1], fx: 'claw' },
  SpiderYellow:{ label: 'Dune Spider', t: 2, biomes: 'd', hp: 13, atk: 5, def: 1, mov: 5, range: [1, 1], fx: 'claw' },
  Mushroom:    { label: 'Shroom', t: 2, biomes: 'g', hp: 20, atk: 4, def: 2, mov: 2, range: [1, 1], fx: 'claw' },
  Mushroom2:   { label: 'Frost Shroom', t: 2, biomes: 's', hp: 20, atk: 4, def: 2, mov: 2, range: [1, 1], fx: 'claw' },
  Lizard:      { label: 'Lizardman', t: 2, biomes: 'g', hp: 17, atk: 5, def: 2, mov: 4, range: [1, 1], fx: 'cut' },
  Lizard2:     { label: 'Dune Lizard', t: 2, biomes: 'd', hp: 17, atk: 5, def: 2, mov: 4, range: [1, 1], fx: 'cut' },
  Mole:        { label: 'Mole', t: 2, biomes: 'dg', hp: 18, atk: 5, def: 2, mov: 3, range: [1, 1], fx: 'claw' },
  Racoon:      { label: 'Tanuki Thief', t: 2, biomes: 'g', hp: 14, atk: 5, def: 1, mov: 5, range: [1, 1], fx: 'cut', dodge: 12 },
  Skull:       { label: 'Skull', t: 3, biomes: 'gd', hp: 15, atk: 6, def: 1, mov: 4, range: [1, 2], fx: 'magic', magic: true, fly: true },
  SkullBlue:   { label: 'Frost Skull', t: 3, biomes: 's', hp: 15, atk: 6, def: 1, mov: 4, range: [1, 2], fx: 'magic', magic: true, fly: true },
  Eye:         { label: 'Watcher', t: 3, biomes: 'g', hp: 14, atk: 6, def: 1, mov: 3, range: [2, 3], fx: 'magic', magic: true, fly: true },
  Eye2:        { label: 'Red Watcher', t: 3, biomes: 'd', hp: 15, atk: 7, def: 1, mov: 3, range: [2, 3], fx: 'magic', magic: true, fly: true },
  Flam:        { label: 'Wisp', t: 3, biomes: 'd', hp: 13, atk: 7, def: 0, mov: 4, range: [1, 2], fx: 'fire', magic: true, fly: true },
  Flam2:       { label: 'Cold Wisp', t: 3, biomes: 's', hp: 13, atk: 7, def: 0, mov: 4, range: [1, 2], fx: 'ice', magic: true, fly: true },
  Owl:         { label: 'Hex Owl', t: 3, biomes: 'g', hp: 15, atk: 6, def: 1, mov: 5, range: [1, 2], fx: 'magic', magic: true, fly: true },
  KappaGreen:  { label: 'Kappa', t: 3, biomes: 'g', hp: 20, atk: 6, def: 3, mov: 4, range: [1, 1], fx: 'claw' },
  Reptile:     { label: 'Drake', t: 3, biomes: 'd', hp: 22, atk: 7, def: 3, mov: 4, range: [1, 1], fx: 'claw' },
  Reptile2:    { label: 'Marsh Drake', t: 3, biomes: 'g', hp: 22, atk: 7, def: 3, mov: 4, range: [1, 1], fx: 'claw' },
  Octopus2:    { label: 'Ink Horror', t: 3, biomes: 's', hp: 18, atk: 6, def: 2, mov: 3, range: [1, 2], fx: 'water' },
  Cyclope:     { label: 'Cyclops', t: 4, biomes: 'g', hp: 32, atk: 9, def: 3, mov: 3, range: [1, 1], fx: 'heavy' },
  Cyclope2:    { label: 'Frost Cyclops', t: 4, biomes: 's', hp: 32, atk: 9, def: 3, mov: 3, range: [1, 1], fx: 'heavy' },
  Beast:       { label: 'Oni Beast', t: 4, biomes: 'd', hp: 30, atk: 10, def: 2, mov: 4, range: [1, 1], fx: 'heavy' },
  Bear:        { label: 'Bear', t: 4, biomes: 'gs', hp: 34, atk: 9, def: 3, mov: 4, range: [1, 1], fx: 'claw' },
  Beast2:      { label: 'Dread Beast', t: 5, biomes: 'gsd', hp: 40, atk: 12, def: 4, mov: 4, range: [1, 1], fx: 'heavy' },
  Spirit:      { label: 'Yurei', t: 4, biomes: 's', hp: 22, atk: 9, def: 2, mov: 5, range: [1, 3], fx: 'magic', magic: true, fly: true, dodge: 15 },
  Spirit2:     { label: 'Onibi', t: 4, biomes: 'd', hp: 22, atk: 9, def: 2, mov: 5, range: [1, 3], fx: 'fire', magic: true, fly: true, dodge: 15 },
  Dragon:      { label: 'Wyrmling', t: 5, biomes: 'g', hp: 38, atk: 11, def: 4, mov: 4, range: [1, 2], fx: 'fire', magic: true, fly: true },
  DragonYellow:{ label: 'Sun Wyrm', t: 5, biomes: 'd', hp: 38, atk: 11, def: 4, mov: 4, range: [1, 2], fx: 'fire', magic: true, fly: true },
  TRex:        { label: 'Tyrant', t: 5, biomes: 'd', hp: 46, atk: 12, def: 5, mov: 3, range: [1, 1], fx: 'heavy' },
};

// Human enemies use character sprites and real weapons.
export const BANDITS = [
  { sprite: 'CamouflageGreen', label: 'Bandit', bg: 'ronin', t: 2 },
  { sprite: 'CamouflageRed', label: 'Bandit Archer', bg: 'hunter', t: 2 },
  { sprite: 'MaskRacoon', label: 'Cutpurse', bg: 'shadow', t: 2 },
  { sprite: 'MaskFrog', label: 'Frog Cultist', bg: 'mystic', t: 3 },
  { sprite: 'RedNinja3', label: 'Red Ninja', bg: 'shadow', t: 3 },
  { sprite: 'Skeleton', label: 'Skeleton', bg: 'guard', t: 3 },
  { sprite: 'DemonRed', label: 'Oni', bg: 'brawler', t: 4 },
  { sprite: 'DemonGreen', label: 'Green Oni', bg: 'brawler', t: 4 },
  { sprite: 'SkeletonDemon', label: 'Bone Lord', bg: 'ronin', t: 5 },
  { sprite: 'Vampire', label: 'Night Noble', bg: 'mystic', t: 5 },
];

// ---------------------------------------------------------------- FX sheets (horizontal strips)
export const FX = {
  claw:  { path: 'FX/Attack/Claw/SpriteSheet.png', fw: 32, fh: 32, frames: 4 },
  cut:   { path: 'FX/Attack/Cut/SpriteSheet.png', fw: 32, fh: 32, frames: 4 },
  slash: { path: 'FX/Attack/SlashCurved/SpriteSheet.png', fw: 32, fh: 32, frames: 4 },
  heavy: { path: 'FX/Attack/CutX/SpriteSheet.png', fw: 32, fh: 32, frames: 4 },
  twin:  { path: 'FX/Attack/CutDouble/SpriteSheet.png', fw: 32, fh: 32, frames: 5 },
  pierce:{ path: 'FX/Attack/SlashDoubleCurved/SpriteSheet.png', fw: 32, fh: 32, frames: 4 },
  magic: { path: 'FX/Magic/Spirit/SpriteSheet.png', fw: 32, fh: 32, frames: 5 },
  fire:  { path: 'FX/Elemental/Flam/SpriteSheet.png', fw: 40, fh: 30, frames: 5 },
  ice:   { path: 'FX/Elemental/Ice/SpriteSheet.png', fw: 32, fh: 32, frames: 10 },
  water: { path: 'FX/Elemental/Water/SpriteSheet.png', fw: 40, fh: 33, frames: 11 },
  heal:  { path: 'FX/Magic/Circle/SpriteSheetWhite.png', fw: 32, fh: 32, frames: 4 },
  smoke: { path: 'FX/Smoke/Smoke/SpriteSheet.png', fw: 32, fh: 32, frames: 6 },
  boom:  { path: 'FX/Elemental/Explosion/SpriteSheet.png', fw: 40, fh: 40, frames: 9 },
};
export const FAMILY_FX = { blade: 'slash', dagger: 'twin', heavy: 'heavy', polearm: 'pierce', bow: 'cut', whip: 'cut', staff: 'magic', tome: 'magic' };
