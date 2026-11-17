// Narrative events. Each choice's run(ctx) returns result text (and may trigger follow-ups via ctx).
// ctx helpers are provided by screens.js: gold(n), heal(frac), hurt(n), item(tier), recruit(tier), fight(opts),
// xp(n), reveal(r), tier, hasGold(n), partyFull(), pickRandomUnit(), blessMaxHp(n), blessAtk(unit, n)

export const TRAVEL_EVENTS = [
  {
    id: 'cart', face: { kind: 'char', name: 'Villager4' }, title: 'Overturned Cart',
    text: 'A merchant cart lies on its side, one wheel still turning. No driver in sight. Crates are scattered across the road.',
    choices: [
      { label: 'Search the crates', run: (c) => {
        if (c.rng.chance(0.25)) { c.hurtAll(3); return 'A snake lunges from the wreckage! Everyone takes a few bites before you drive it off.'; }
        if (c.rng.chance(0.45)) { const it = c.item(c.tier); return `Beneath a tarp you find: ${it}.`; }
        const g = c.gold(c.rng.int(12, 30)); return `You find a pouch with ${g} gold.`;
      } },
      { label: 'Leave it be', run: () => 'Some things are better left alone. You walk on.' },
    ],
  },
  {
    id: 'wounded', face: { kind: 'char', name: 'Villager2' }, title: 'Wounded Traveler',
    text: '"Please..." A traveler slumps against a tree, clutching a bleeding side. "Monsters took my things. I can still fight, if you help me."',
    choices: [
      { label: 'Bandage them (10 gold of supplies)', req: (c) => c.hasGold(10), run: (c) => {
        c.gold(-10);
        if (!c.partyFull()) { const u = c.recruit(Math.max(1, c.tier - 1), true); return `${u} gets back on their feet. "I owe you my life. Let me walk with you."`; }
        const g = c.gold(25); return `Grateful, they press ${g} gold into your hand and limp toward the nearest village.`;
      } },
      { label: 'Share some food and move on', run: (c) => { c.xpAll(8); return 'You share a meal and swap stories. Your companions feel a little wiser.'; } },
      { label: 'Ignore them', run: () => 'You keep walking. Their cries fade behind you.' },
    ],
  },
  {
    id: 'ambush', face: { kind: 'char', name: 'CamouflageGreen' }, title: 'Ambush!',
    text: 'Figures rise from the tall grass with blades drawn. "Your coin or your life, wanderer."',
    choices: [
      { label: 'Fight!', run: (c) => { c.fight({ bandits: true, noRetreat: true }); return null; } },
      { label: 'Pay them off (lose a third of your gold)', run: (c) => { const g = c.gold(-Math.ceil(c.goldNow() / 3)); return `They count your coin and melt back into the grass. (${g} gold)`; } },
    ],
  },
  {
    id: 'campfire', face: { kind: 'char', name: 'OldMan3' }, title: 'Cold Campfire',
    text: 'A ring of stones with warm ashes. Someone camped here recently. It looks like a good place to rest.',
    choices: [
      { label: 'Rest a while', run: (c) => {
        if (c.rng.chance(0.25)) { c.fight({}); return null; }
        c.healAll(0.35); return 'You rest by the embers. Wounds close and spirits lift.';
      } },
      { label: 'Keep moving', run: () => 'You press on before whoever left comes back.' },
    ],
  },
  {
    id: 'merchant', face: { kind: 'char', name: 'Sultan' }, title: 'Traveling Merchant',
    text: '"Ah, a customer! Rare goods, fair prices. Mostly fair."',
    choices: [
      { label: 'See the wares', run: (c) => { c.shop(); return null; } },
      { label: 'No thanks', run: () => '"Your loss, friend!"' },
    ],
  },
  {
    id: 'fog', face: { kind: 'monster', name: 'Spirit' }, title: 'Whispering Fog',
    text: 'A pale fog rolls over the path. Voices murmur your name from inside it.',
    choices: [
      { label: 'Walk into the fog', run: (c) => {
        if (c.rng.chance(0.55)) { c.xpAll(25); return 'The voices teach as much as they frighten. Everyone emerges sharper. (+25 XP)'; }
        c.hurtAll(5); return 'Cold hands claw at you in the mist. You stumble out, shaken and bleeding.';
      } },
      { label: 'Go around (slow)', run: (c) => { c.wasteSteps(20); return 'You take the long way. It costs half a day, but you arrive in one piece.'; } },
    ],
  },
  {
    id: 'gambler', face: { kind: 'char', name: 'Inspector' }, title: 'Roadside Gambler',
    text: '"Fancy a game of dice? Double or nothing, twenty gold a throw."',
    choices: [
      { label: 'Roll (20 gold)', req: (c) => c.hasGold(20), run: (c) => {
        if (c.rng.chance(0.47)) { c.gold(20); return 'Sixes! You walk off with his money and his scowl.'; }
        c.gold(-20); return 'Snake eyes. He grins and pockets your coin.';
      } },
      { label: 'Walk away', run: () => '"Coward!" he calls after you.' },
    ],
  },
  {
    id: 'shrineRoad', face: { kind: 'char', name: 'Monk' }, title: 'Pilgrim Monk',
    text: 'A monk sits in meditation beside the road. He opens one eye. "You carry much pain. Shall I ease it?"',
    choices: [
      { label: 'Accept his blessing', run: (c) => { c.healAll(1); return 'Warmth spreads through you. Every wound closes.'; } },
      { label: 'Ask for training instead', run: (c) => { c.xpAll(15); return 'He teaches breathing and patience. (+15 XP to all)'; } },
    ],
  },
];

export const WANDERER_EVENTS = [
  {
    id: 'hermit', title: 'Old Hermit',
    text: '"Hm. You have the look of someone who will die young. Unless... I teach you a thing or two. For a price."',
    choices: [
      { label: 'Train the leader (40 gold): +1 ATK', req: (c) => c.hasGold(40), run: (c) => { c.gold(-40); const n = c.blessAtk(c.hero(), 1); return `${n} practices until dawn. (+1 ATK)`; } },
      { label: 'Ask about the land', run: (c) => { c.reveal(14); return 'He sketches the surrounding land in the dirt. Your map grows clearer.'; } },
      { label: 'Leave', run: () => '"Hmph. Suit yourself."' },
    ],
  },
  {
    id: 'blessing', title: 'Shrine Keeper',
    text: '"The spirits watch over travelers on this road. May I offer their blessing?"',
    choices: [
      { label: 'Receive the blessing', run: (c) => { c.blessMaxHp(2); c.healAll(0.3); return 'A gentle light settles over your party. (+2 max HP to all)'; } },
      { label: 'Politely decline', run: () => '"Safe travels, then."' },
    ],
  },
  {
    id: 'swordsman', title: 'Wandering Swordsman',
    text: '"I have no master, no home, and no coin. But I have a sword, and I am tired of walking alone."',
    choices: [
      { label: 'Welcome them', req: (c) => !c.partyFull(), run: (c) => { const n = c.recruit(c.tier, true, 'ronin'); return `${n} joins your party.`; } },
      { label: 'Share a drink and part ways', run: (c) => { c.xpAll(10); return 'You trade war stories until the fire burns low. (+10 XP)'; } },
    ],
  },
  {
    id: 'noble', title: 'Worried Noble',
    text: '"Monsters have made a lair near here. My family will pay handsomely if it is destroyed."',
    choices: [
      { label: 'Accept the bounty', run: (c) => { const ok = c.bounty(); return ok ? 'They mark the lair on your map. "Clear it and the reward is yours."' : '"Ah, it seems the lairs nearby are already cleared. Here, for your trouble." (+15 gold)'; } },
      { label: 'Decline', run: () => '"Then the gods help us."' },
    ],
  },
  {
    id: 'tengu', title: 'Riddling Tengu',
    text: '"Kaa! Answer me this, little walker: what grows stronger the more of it you lose?"',
    choices: [
      { label: '"Hunger."', run: (c) => { c.hurtAll(2); return '"Wrong! Kaa-ha!" A gust of wind knocks everyone off their feet.'; } },
      { label: '"Resolve."', run: (c) => { const it = c.item(Math.min(5, c.tier + 1)); return `"Hmph. Good enough." The tengu drops something shiny: ${it}.`; } },
      { label: '"Silence."', run: (c) => { c.gold(15); return '"Clever, but no." It flips you a coin for trying. (+15 gold)'; } },
    ],
  },
  {
    id: 'child', title: 'Lost Child',
    text: '"I can\'t find my village..." A child sniffles, clutching a wooden toy.',
    choices: [
      { label: 'Point the way and give 10 gold', req: (c) => c.hasGold(10), run: (c) => { c.gold(-10); c.xpAll(20); return 'The child runs off toward the road, waving. Kindness strengthens your resolve. (+20 XP)'; } },
      { label: 'Point the way', run: (c) => { c.xpAll(8); return 'The child nods and hurries off. (+8 XP)'; } },
    ],
  },
];

export const SHRINE_EVENT = {
  title: 'Forgotten Shrine',
  text: 'Moss covers the old stone. Faded offerings lie at its feet. The air hums faintly.',
  choices: [
    { label: 'Pray', run: (c) => {
      const r = c.rng.next();
      if (r < 0.3) { c.blessMaxHp(3); return 'The stone glows warmly. (+3 max HP to all)'; }
      if (r < 0.55) { c.healAll(1); return 'Cool water seeps from the stone and washes your wounds away.'; }
      if (r < 0.8) { const it = c.item(c.tier); return `Something glints among the offerings: ${it}.`; }
      c.hurtAll(4); return 'The shrine is angry. Spectral fire licks at your party.';
    } },
    { label: 'Offer 30 gold', req: (c) => c.hasGold(30), run: (c) => {
      c.gold(-30); const n = c.blessAtk(c.pickRandomUnit(), 1); c.blessMaxHp(2);
      return `The spirits accept. ${n} feels power surge through them. (+1 ATK, and +2 max HP to all)`;
    } },
    { label: 'Leave', run: () => 'You bow and step away.' },
  ],
};
