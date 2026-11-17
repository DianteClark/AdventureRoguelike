# Ronin Roads

**▶ Play it: https://dianteclark.github.io/AdventureRoguelike/**

A sandbox tactical roguelike that runs in the browser. You start the journey alone. You can recruit a band of misfits or stay solo. Battles happen on the ground where you meet your enemies. **When your leader dies, the run is over.**

Built with plain HTML, CSS and JavaScript (ES modules, no build step), using art and audio from the [Ninja Adventure asset pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by Pixel-boy and AAA (CC0).

## Play

- **Online:** https://dianteclark.github.io/AdventureRoguelike/ (works on phones and desktop)
- **Locally:** serve the folder with any static server, then open `http://localhost:8000`. (A server is required because ES modules don't load from `file://`.)
  ```sh
  python3 -m http.server 8000
  ```

## What's new (v0.2 — the "juice" update)

- **Feel**: screen shake, hit-stop on crits, sparks/blood/embers, recoiling and dodging units, pop-in damage numbers, VS splash + iris transitions into battle, sliding turn banners, level-up fanfare, falling sakura on the title.
- **Atmosphere**: day/night cycle with real lighting (torchlight, lantern-lit villages, glowing shrines), weather per biome (rain, thunderstorms, sandstorms, heatwaves, snow, blizzards), biome title cards and music, minimap + full map.
- **Class skills**: Iaido, Earthshaker, Pinning Shot, Bulwark, Shadowstep, Fireball, Sanctuary, Rally Cry.
- **Status effects**: burn, poison, chill, root, stun + buffs. Monsters inflict them.
- **Champions**: named elite packs with crowns and better loot.
- **Guardians & the Sky Gate**: three giant biome bosses with telegraphed attacks, summons and enrage — beat them all to face the Tengu King and become a Legend.
- **Renown**: earned every run, unlocks legacies (extra gold, better gear, a starting companion, more hero choices, more HP, a treasure map).
- **More to do**: 15 road events, make camp in the wild (beware night ambushes), quest log.

## How it plays

**Overworld**
- The map is procedurally generated, with three biomes: Greenlands (center), Frostreach (north) and Ember Dunes (south).
- Tap to travel. Fog of war hides anything you haven't seen yet. Enemies get stronger the farther you go from the starting point, and the snow and desert biomes are tougher than the Greenlands.
- **Villages:** rest at the inn, hire companions at the tavern, buy and sell at the market. The tavern and market restock every few days.
- **Shrines (?)**: pray or make an offering for a blessing. Sometimes it's a curse.
- **Lairs (!)**: an elite monster group guarding a hoard. Nobles may also offer a bounty on one.
- **Travelers (…)**: story events with choices.
- **Chests**: gold and gear. Some are trapped.
- Random road events: ambushes, merchants, gamblers, haunted fog and more.

**Battles**
- Turn-based, on a grid laid over the local terrain. Trees, rocks and water block movement. Bushes give +15 dodge.
- Tap a unit to see where it can move (blue). Tap a foe to see the damage forecast, then tap again to strike. Defenders counterattack when the attacker is within their range.
- Tap an enemy at any time to see its danger zone.
- Retreat is possible, but it isn't guaranteed.

**Weapon families** (each one plays differently)

| Family | Range | Effect |
|---|---|---|
| Blade | 1 | Reliable, with bonus accuracy and crit |
| Dagger | 1 | Strikes twice at reduced power |
| Heavy | 1 | Big damage that ignores 2 DEF, less accurate |
| Polearm | 1 | Also hits the enemy standing behind the target |
| Bow | 2–3 | Can't hit adjacent foes |
| Whip | 1–2 | Reach |
| Staff | 1–2 | Magic that ignores half of DEF |
| Tome | 1–2 | Weak magic, can heal allies |

**Loot**
- Every character has two slots: **Weapon** and **Gear** (armor, helm, bracers, boots, ring, amulet).
- Items come in five tiers: Rusty/Worn → Iron/Sturdy → Steel/Fine → Masterwork → Legendary. The tier is shown by the item's color.
- Tier 2 and higher can roll traits that change the item's name, such as *Vampiric Steel Katana of the Tengu*. The game has 21 traits, so a small set of icons gives hundreds of distinct items.

**Permadeath**
- The run is autosaved, so you can close the tab and keep playing later. When the leader (★) falls, the save is erased.
- Companions who fall are gone for good.

## Project layout

```
index.html, style.css
src/
  main.js       boot, main loop, input, run lifecycle
  state.js      run state, save/load (localStorage), graveyard
  worldgen.js   procedural world, villages, roads, POIs, enemy groups
  world.js      overworld scene: movement, fog, roaming enemies
  battle.js     tactical battles: combat math, AI, animations
  screens.js    HUD, title, party/bag, villages, events, victory/death
  events.js     narrative event data
  units.js      units, stats, leveling, item generation & naming
  data.js       weapons, gear, traits, backgrounds, monsters, FX
  tiles.js      tileset coordinates, autotiling, object definitions
  render.js     canvas drawing helpers
  grid.js       BFS / A* pathfinding
  ui.js         DOM helpers
assets/         the subset of Ninja Adventure used by the game (audio converted to mp3)
```

## Credits

- Art, music and sound: **Ninja Adventure Asset Pack** by [Pixel-boy](https://pixel-boy.itch.io/) and [AAA](https://www.instagram.com/challenger.aaa/). License: CC0. See `assets/LICENSE-NinjaAdventure-CC0.txt`.
