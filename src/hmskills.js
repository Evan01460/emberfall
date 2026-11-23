// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// HIDDEN and MYTHIC CLASS ADVANCEMENT — five more signature skills for each of the ten secret classes, one at every rank (see HM in advskills.js:
// hidden classes at levels 12 / 24 / 40 / 60 / 80, mythic classes at 20 / 35 / 50 / 70 / 90).
//
// These are the best skills in the game and are built like it: each one is a small show of its own that combines several mechanics, and each
// class has mechanics only IT uses:
//   Desperado    the die the class already rolls decides how hard the skill hits, how many dice fall, and which lane is loaded
//   Archivist    ink mines, hunting words, a censor's bar, a library that fights for you, a vortex that closes like a book
//   Soulsmith    a spiral of rivets, a marching line of anvils, a furnace hook, a living forge-golem, a starforged leap
//   Broker       a short, a compounding bomb, a hostile merger, a time deposit, the crash
//   Transmuter   caustic mines, homunculi, a flash-freeze that shatters, acid, the Great Work
//   Apostle      a briar ring, a swarm of seeds, a treant, a ring of roots, the Canopy of Dawn
//   Void         a mirror-veil, a black spiral, a maw that eats, unmaking, the Last Dark
//   Titan        a slag pit, orbiting hammers, a furnace totem, Colossus Fall, the World Forge
//   Philosopher  mercury rain, a transmutation circle, a legion of homunculi, five essences, the Opus Magnum
//   Gilded       a gold-fall, tithe waves, a vault guard, a bounty, the Treasury
// The engine is src/server/skillscripts.js (new steps: shots, pull, mark, mine, seekers; modifiers: rep, roll, steal, jackpot); the art is
// src/client/scriptfx.js (new glyphs and familiars) and the projectile art in skillfx.js.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const HM_KITS = {};       // hidden class id -> [[skillId, level], ...]   (merged into CLASSES by data.js)

export function registerHM(add, sk, MYTHICS) {
  const def = (cls, lvl, id, name, o) => {
    add(sk(id, name, 'script', [cls], { src: 'level', lvl, quiet: true, type: 'arcane', ...o }));
    if (MYTHICS[cls]) MYTHICS[cls].skills.push([id, lvl]); else (HM_KITS[cls] ??= []).push([id, lvl]);
  };
  const D = 'desperado', AR = 'archivist', SS = 'soulsmith', BR = 'broker', TR = 'transmuter', AP = 'apostle', VS = 'void_sovereign', TF = 'titan_forgemaster', PH = 'philosopher', GI = 'gilded';

  // ═══ DESPERADO — luck, bluff and one last bullet ═════════════════════════════════════════════════════════════════════════════════════
  // (Every Desperado skill is preceded by the class's own die roll. Steps marked `roll` hit harder or softer by the die; some read the face.)
  def(D, 12, 'snake_eyes', 'Snake Eyes', { cd: 9000, mp: 20, cast: 200, power: 62, at: 'cursor', range: 11, theme: 'dice', col: '#ff9ad0', type: 'blunt', g: 'star',
    desc: 'The die you roll is the number of explosive dice you throw. Roll a five or a six and a second set tumbles out of the sky.',
    steps: [{ t: 'shots', countRoll: true, spread: 64, speed: 14, range: 11, radius: 0.32, aoe: 1.7, power: 62, vi: 'dice', type: 'blunt', vfxEnd: 'dice_pop' },
      { t: 'rain', minFace: 5, from: 'cursor', n: 6, area: 3.2, over: 700, r: 1.5, power: 58, warn: 650, fall: 'dice', at: 350 }] });
  def(D, 24, 'royal_flush', 'Royal Flush', { cd: 15000, mp: 32, cast: 320, power: 72, theme: 'card', col: '#ff9ad0', type: 'pierce', g: 'star',
    desc: 'Five cards fan out in five suits, one after another: every card cuts a lane through everything and each one that connects heals you. Then the table flips and the cards ring out.',
    steps: [{ t: 'lanes', aim: 'fan', n: 5, spread: 1.15, len: 15, w: 1.35, gap: 120, warn: 380, power: 72, roll: true, steal: 0.012 },
      { t: 'rings', from: 'self', n: 2, gap: 280, speed: 8.5, w: 1.3, power: 58, roll: true, at: 1100 }] });
  def(D, 40, 'russian_roulette', 'Russian Roulette', { cd: 20000, mp: 36, cast: 420, power: 60, theme: 'card', col: '#ff6aa8', type: 'blunt', g: 'skull',
    desc: 'Six chambers, six lanes around you, fired one by one - and ONE of them is loaded: seven times the damage and almost twice as wide. You never know which until the click.',
    steps: [{ t: 'mark', from: 'self', r: 8, v: 0.18, ms: 5000 }, { t: 'lanes', aim: 'around', n: 6, len: 13, w: 1.25, gap: 330, warn: 520, power: 60, roll: true, jackpot: { n: 1, mult: 7 }, at: 200 }] });
  def(D, 60, 'last_hand', 'Last Hand', { cd: 42000, mp: 44, cast: 250, power: 190, theme: 'card', col: '#ffd36a', type: 'blunt', g: 'ace',
    desc: 'Push every chip in. For seven seconds NOTHING can kill you (you cannot drop below 1 HP), you hit 55% harder, steal life, and a storm of cards circles you. When the hand ends you cash out in a huge, stunning blast.',
    steps: [{ t: 'buff', dur: 7000, buff: { dmg: 0.55, ls: 0.1, undying: 1, red: 0.1 } }, { t: 'orbit', n: 6, R: 2.5, dur: 7000, tick: 380, power: 30, r: 0.9, spin: 3.4, roll: true },
      { t: 'nova', from: 'self', r: 5.8, power: 190, stun: 1300, roll: true, at: 7000 }] });
  def(D, 80, 'house_always_wins', 'The House Always Wins', { cd: 62000, mp: 72, cast: 600, power: 260, at: 'cursor', range: 9, theme: 'card', col: '#ffd36a', type: 'blunt', g: 'ace',
    desc: 'You own the table. A casino floor opens at the target: everyone on it is slowed and takes 30% more damage while cards and dice crash down, and when the house closes the whole floor detonates. The die decides the stakes.',
    steps: [{ t: 'zone', from: 'cursor', r: 6, dur: 8400, tick: 500, effect: 'slow', vuln: 0.3, power: 30, roll: true }, { t: 'rain', from: 'cursor', n: 22, area: 5.6, over: 6000, r: 1.35, power: 70, warn: 700, fall: 'card', roll: true, at: 300 },
      { t: 'rain', from: 'cursor', n: 10, area: 5.2, over: 5000, r: 1.4, power: 62, warn: 700, fall: 'dice', roll: true, at: 600 }, { t: 'nova', from: 'cursor', r: 6.6, power: 260, stun: 1800, roll: true, at: 8200 }] });

  // ═══ ARCHIVIST — ink, quills and living words ════════════════════════════════════════════════════════════════════════════════════════
  def(AR, 12, 'marginalia', 'Marginalia', { cd: 12000, mp: 22, cast: 250, power: 58, at: 'cursor', range: 8, theme: 'page', col: '#8ad8d0', g: 'void',
    desc: 'Leave five footnotes in the margin ahead of you. Each is a hidden rune: the first enemy to step near it sets it off in a slowing burst of ink. They wait for sixteen seconds.',
    steps: [{ t: 'mine', place: 'fan', n: 5, R: 5.4, spread: 1.45, r: 1.8, power: 58, slow: 2400, dur: 16000, gap: 110 }] });
  def(AR, 24, 'hunting_words', 'Hunting Words', { cd: 14000, mp: 30, cast: 300, power: 46, theme: 'quill', col: '#c8fff0', g: 'star',
    desc: 'Eight living words rise round you and HUNT: each chooses its own enemy, curves after it, strikes twice, slows it and heals you a little.',
    steps: [{ t: 'seekers', n: 8, speed: 11.5, power: 46, hits: 2, r: 0.65, slow: 1500, gap: 80, life: 6500, steal: 0.012 }] });
  def(AR, 40, 'redaction', 'Redaction', { cd: 20000, mp: 38, cast: 450, power: 105, at: 'cursor', range: 8, theme: 'ink', col: '#8ad8d0', g: 'void',
    desc: 'Strike it from the record: the target is blacked out - held in place and 30% more vulnerable - while a censor\'s bar of ink sweeps through and shoves everything aside.',
    steps: [{ t: 'zone', from: 'cursor', r: 4.2, dur: 3800, tick: 400, effect: 'slow', hold: 650, vuln: 0.3 }, { t: 'wall', span: 11, w: 1.7, speed: 4.4, dur: 2700, power: 105, push: 1.1, at: 250 }] });
  def(AR, 60, 'living_library', 'Living Library', { cd: 38000, mp: 50, cast: 500, power: 44, theme: 'ink', col: '#c8fff0', g: 'star',
    desc: 'The shelves wake. Two floating tomes hurl words at your enemies for eighteen seconds while pages orbit you and mend you and your allies; your mind clears and your spells come faster.',
    steps: [{ t: 'summon', kind: 'tome', n: 2, dur: 18000, power: 44, every: 650, range: 11, vi: 'word', aoe: 1.2, steal: 0.004 }, { t: 'orbit', n: 4, R: 2.3, dur: 18000, tick: 500, power: 30, r: 0.8, spin: 2.4, heal: 0.03 },
      { t: 'buff', dur: 18000, buff: { mpRegen: 3, dmg: 0.2 }, radius: 8 }] });
  def(AR, 80, 'book_closes', 'The Book Closes', { cd: 66000, mp: 82, cast: 700, power: 250, at: 'cursor', range: 9, theme: 'quill', col: '#8ad8d0', g: 'void',
    desc: 'The page turns. A vortex of ink drags every enemy into the gutter, twelve hunting words descend and a rain of quills follows - and when the book SLAMS shut, everything inside is crushed and stunned.',
    steps: [{ t: 'vortex', from: 'cursor', r: 7, pull: 5.5, dur: 2600, tick: 400, power: 48, then: { r: 5.6, power: 250, stun: 2200 } }, { t: 'seekers', n: 12, speed: 12, power: 80, hits: 2, r: 0.7, gap: 70, life: 5000, steal: 0.015, at: 1100 },
      { t: 'rain', from: 'cursor', n: 16, area: 5.4, over: 1600, r: 1.4, power: 85, warn: 600, fall: 'quill', at: 1800 }] });

  // ═══ SOULSMITH — the Cold Forge in your hands ═════════════════════════════════════════════════════════════════════════════════════════
  def(SS, 12, 'rivet_storm', 'Rivet Storm', { cd: 10000, mp: 22, cast: 150, power: 34, theme: 'ember', col: '#ff9f6b', type: 'pierce', g: 'flame',
    desc: 'The forge-gun spins up: a spiralling storm of red-hot rivets, two at a time, that pass through everything and leave enemies a little more vulnerable.',
    steps: [{ t: 'shots', rep: { n: 9, gap: 95, turn: 0.38 }, count: 2, spread: 14, speed: 19, range: 11, radius: 0.3, pierce: 2, power: 34, vi: 'rivet', type: 'pierce', vulnHit: { v: 0.1, ms: 4000 } }] });
  def(SS, 24, 'anvil_chorus', 'Anvil Chorus', { cd: 15000, mp: 34, cast: 450, power: 82, at: 'cursor', range: 11, theme: 'ember', col: '#ff9f6b', type: 'blunt', g: 'anvil',
    desc: 'A line of anvils falls from the sky and marches toward the target one after another, each ringing like a bell and stunning what it crushes.',
    steps: [{ t: 'rain', from: 'self', path: 10, n: 8, over: 1500, r: 1.5, power: 82, warn: 520, fall: 'anvil', stun: 900 }] });
  def(SS, 40, 'forge_hook', 'Forge Hook', { cd: 19000, mp: 38, cast: 300, power: 120, theme: 'ember', col: '#ffb84a', type: 'arcane', g: 'flame',
    desc: 'Throw a chain of glowing slag: every enemy near is hauled in to your feet, the forge floor ignites under them, and the blast of the quench throws them into a stun.',
    steps: [{ t: 'pull', r: 8.5, stop: 1.6, power: 50 }, { t: 'zone', from: 'self', r: 3.4, dur: 3200, tick: 380, power: 42, effect: 'burn', at: 150 }, { t: 'nova', from: 'self', r: 3.6, power: 120, stun: 1300, at: 450 }] });
  def(SS, 60, 'forge_golem', 'Forge-Golem', { cd: 40000, mp: 50, cast: 500, power: 100, theme: 'hammer', col: '#ff9f6b', type: 'blunt', g: 'anvil',
    desc: 'You hammer a colossus out of slag. It follows you for twenty seconds, smashes everything in a wide arc, and its forge-heat draws the enemies\' attention while it cuts the damage you take.',
    steps: [{ t: 'summon', kind: 'golem', n: 1, dur: 20000, power: 100, every: 950, range: 2, melee: true, aoe: 2.0, aura: { taunt: 1, red: 0.25 }, r: 6 }, { t: 'buff', dur: 12000, buff: { red: 0.15, dmg: 0.2 } }] });
  def(SS, 80, 'starforged_apotheosis', 'Starforged Apotheosis', { cd: 64000, mp: 78, cast: 400, power: 250, theme: 'ember', col: '#ffd0a0', type: 'arcane', g: 'star',
    desc: 'You become the forge. Leap into the air and come down like a star: a stunning crater, three shockwaves, and for four seconds three beams of starfire spin around you while you are hardened and empowered.',
    steps: [{ t: 'leap', dist: 8, power: 250, r: 5, stun: 1700, rings: 3 }, { t: 'beams', from: 'self', n: 3, len: 8.5, w: 1.4, spin: 1.5, dur: 4600, tick: 220, power: 62, follow: true, warn: 300, at: 420 },
      { t: 'buff', dur: 8000, buff: { dmg: 0.4, red: 0.3 }, at: 300 }] });

  // ═══ BROKER — you saw it coming ═══════════════════════════════════════════════════════════════════════════════════════════════════════
  def(BR, 12, 'short_sell', 'Short Sell', { cd: 11000, mp: 24, cast: 200, power: 36, theme: 'coin', col: '#e8e8ff', type: 'pierce', g: 'coin',
    desc: 'Bet against the room: everyone near you is marked and takes 30% more damage for eight seconds, then a fan of silver coins goes out to collect.',
    steps: [{ t: 'shots', count: 7, spread: 56, speed: 21, range: 12, radius: 0.28, pierce: 2, power: 36, vi: 'silver', type: 'pierce', at: 200 }, { t: 'mark', from: 'self', r: 8.5, v: 0.3, ms: 8000 }] });
  def(BR, 24, 'compound_interest', 'Compound Interest', { cd: 17000, mp: 38, cast: 350, power: 70, theme: 'hourglass', col: '#e8e8ff', type: 'pierce', g: 'coin',
    desc: 'Open an account on the five most valuable enemies. The interest compounds for three seconds, then every account is called in at once - and each one that pays out may call in the people next to it.',
    steps: [{ t: 'bombs', count: 5, delay: 3000, r: 2.2, power: 190, cascade: 0.5 }, { t: 'mark', from: 'self', r: 9, v: 0.15, ms: 3500 }] });
  def(BR, 40, 'hostile_merger', 'Hostile Merger', { cd: 21000, mp: 42, cast: 450, power: 190, at: 'cursor', range: 9, theme: 'coin', col: '#ffe36b', type: 'pierce', g: 'coin',
    desc: 'Serve the papers: a vortex of gold drags every enemy into one place, curses them with a 35% damage penalty, and the merger completes in a stunning detonation.',
    steps: [{ t: 'vortex', from: 'cursor', r: 6.2, pull: 6, dur: 2000, tick: 350, power: 36, then: { r: 4.2, power: 190, stun: 1500 } }, { t: 'mark', from: 'cursor', r: 6.5, v: 0.35, ms: 7000 }] });
  def(BR, 60, 'time_deposit', 'Time Deposit', { cd: 38000, mp: 52, cast: 550, power: 55, theme: 'hourglass', col: '#d8e0ff', type: 'pierce', g: 'coin',
    desc: 'Freeze a moment of the market. Inside a wide ring enemies crawl and take 30% more damage; you and your allies mend and take 30% less. Nine seconds, and the interest it earns is paid in coin.',
    steps: [{ t: 'zone', from: 'self', r: 6.4, dur: 9000, tick: 500, effect: 'aegis', heal: 0.025, red: 0.3, power: 0, follow: true }, { t: 'zone', from: 'self', r: 6.4, dur: 9000, tick: 500, effect: 'slow', vuln: 0.3, power: 55, follow: true },
      { t: 'rain', from: 'self', n: 10, area: 6, over: 8000, r: 1.1, power: 55, warn: 600, fall: 'coin', at: 600 }] });
  def(BR, 80, 'black_monday', 'Black Monday', { cd: 66000, mp: 80, cast: 700, power: 280, theme: 'coin', col: '#ffd36a', type: 'pierce', g: 'coin',
    desc: 'The crash you predicted. The whole room is marked 50% vulnerable, the floor falls out from under them in thirty collapsing coins, and three waves of sell-off sweep out from you.',
    steps: [{ t: 'rain', from: 'self', n: 30, area: 8.5, over: 3800, r: 1.5, power: 70, warn: 650, fall: 'coin', at: 250 }, { t: 'mark', from: 'self', r: 11, v: 0.5, ms: 10000 }, { t: 'rings', from: 'self', n: 3, gap: 600, speed: 9, w: 1.5, power: 100, at: 800 },
      { t: 'nova', from: 'self', r: 7, power: 280, stun: 1400, at: 3600 }] });

  // ═══ TRANSMUTER — the cauldron answers to you ═════════════════════════════════════════════════════════════════════════════════════════
  def(TR, 12, 'caustic_mines', 'Caustic Mines', { cd: 12000, mp: 24, cast: 250, power: 62, at: 'cursor', range: 8, theme: 'potion', col: '#d0a0ff', g: 'drop',
    desc: 'Lob four unstable flasks onto the ground around the target. Each one bursts in corrosive vapour when an enemy walks near it, slowing and weakening what it catches.',
    steps: [{ t: 'mine', place: 'cursor', n: 4, R: 3.2, r: 1.9, power: 62, slow: 2600, vuln: 0.2, dur: 16000, gap: 130 }] });
  def(TR, 24, 'homunculi', 'Homunculi', { cd: 30000, mp: 40, cast: 450, power: 44, theme: 'potion', col: '#d0a0ff', g: 'drop',
    desc: 'Two little bottled creatures of your own making follow you and hurl flasks that burst in a cloud. They last sixteen seconds.',
    steps: [{ t: 'summon', kind: 'homunculus', n: 2, dur: 16000, power: 44, every: 900, range: 8.5, vi: 'vial', aoe: 1.5 }] });
  def(TR, 40, 'phase_change', 'Phase Change', { cd: 22000, mp: 44, cast: 450, power: 170, at: 'cursor', range: 8, theme: 'gem', col: '#bfe8ff', g: 'frost',
    desc: 'Flash-freeze the target: everything inside is locked solid and 30% more fragile... and when the ice reaches its limit it SHATTERS for enormous damage.',
    steps: [{ t: 'zone', from: 'cursor', r: 4.2, dur: 2700, tick: 350, effect: 'slow', hold: 600, vuln: 0.3, then: { r: 4.4, power: 170, stun: 1200 } }] });
  def(TR, 60, 'aqua_regia', 'Aqua Regia', { cd: 30000, mp: 54, cast: 500, power: 70, at: 'cursor', range: 9, theme: 'potion', col: '#9ae06a', g: 'drop',
    desc: 'A wave of acid sweeps outward, shoving and burning everything, and leaves a pool that keeps eating: enemies in it take damage every moment and 25% more from everything else.',
    steps: [{ t: 'wall', span: 8.5, w: 1.6, speed: 5.2, dur: 2700, power: 70, push: 1.4 }, { t: 'zone', from: 'cursor', r: 3.7, dur: 6000, tick: 350, effect: 'burn', power: 38, vuln: 0.25, at: 500 }] });
  def(TR, 80, 'magnum_opus', 'Magnum Opus', { cd: 64000, mp: 76, cast: 700, power: 150, theme: 'gem', col: '#e8c8ff', g: 'drop',
    desc: 'The Great Work completes. Your whole party is healed by 40% and empowered by 45% for nine seconds, a rain of philosopher\'s gems falls and heals as it lands, and a transmutation blast tears outward.',
    steps: [{ t: 'heal', pct: 0.4, radius: 11 }, { t: 'buff', dur: 9000, buff: { dmg: 0.45, regen: 0.04, mpRegen: 3 }, radius: 11 }, { t: 'rain', from: 'self', n: 22, area: 6.5, over: 3200, r: 1.3, power: 70, warn: 600, fall: 'gem', healAllies: 0.03, at: 300 },
      { t: 'nova', from: 'self', r: 5.6, power: 150, stun: 1300, at: 700 }] });

  // ═══ APOSTLE — Yggdrasil's voice ══════════════════════════════════════════════════════════════════════════════════════════════════════
  def(AP, 20, 'briar_ring', 'Briar Ring', { cd: 12000, mp: 26, cast: 300, power: 70, theme: 'seed', col: '#6adf8a', type: 'pierce', g: 'leaf',
    desc: 'Plant a ring of eight thorn-nests around yourself. Anything that touches one is bitten and ROOTED in place. Sixteen seconds.',
    steps: [{ t: 'mine', place: 'ring', n: 8, R: 3.4, r: 1.7, power: 70, hold: 1300, dur: 16000, gap: 70 }] });
  def(AP, 35, 'spore_swarm', 'Spore Swarm', { cd: 15000, mp: 34, cast: 300, power: 52, theme: 'seed', col: '#b8ff9a', type: 'pierce', g: 'leaf',
    desc: 'Twelve living seeds burst from your hands and hunt: each strikes an enemy, bursts into spores that hurt what stands next to it, and feeds life back to you.',
    steps: [{ t: 'seekers', n: 12, speed: 11, power: 52, hits: 1, r: 0.7, aoe: 1.7, gap: 60, life: 6000, steal: 0.012 }] });
  def(AP, 50, 'treant_guardian', 'Treant Guardian', { cd: 44000, mp: 58, cast: 600, power: 120, theme: 'leaf', col: '#6adf8a', type: 'pierce', g: 'leaf',
    desc: 'Call a treant out of the ground. For twenty-two seconds it draws every enemy\'s attention, crushes them in wide sweeps and its canopy heals everyone beneath it.',
    steps: [{ t: 'summon', kind: 'treant', n: 1, dur: 22000, power: 120, every: 1100, range: 2, melee: true, aoe: 2.3, aura: { taunt: 1, heal: 0.022, red: 0.2 }, r: 6.5 }] });
  def(AP, 70, 'yggdrasil_grasp', "Yggdrasil's Grasp", { cd: 36000, mp: 64, cast: 700, power: 100, theme: 'leaf', col: '#6adf8a', type: 'pierce', g: 'leaf',
    desc: 'The roots of the world answer: eight great roots burst outward from you in a ring, one after another, stunning and crushing; behind them a healing glade blooms for six seconds.',
    steps: [{ t: 'lanes', aim: 'around', n: 8, len: 12.5, w: 1.7, gap: 150, warn: 450, power: 100, stun: 1300 }, { t: 'zone', from: 'self', r: 5.6, dur: 7000, tick: 700, heal: 0.05, effect: 'heal', at: 1300 }] });
  def(AP, 90, 'canopy_of_dawn', 'Canopy of Dawn', { cd: 68000, mp: 88, cast: 800, power: 220, theme: 'petal', col: '#ffd8e8', type: 'pierce', g: 'leaf',
    desc: 'The World Tree opens its crown. For nine seconds a field of light heals allies and burns enemies (who take 30% more damage), fourteen petals hunt every foe and three waves of green force roll out. You and your allies are mended and emboldened.',
    steps: [{ t: 'zone', from: 'self', r: 7.5, dur: 9000, tick: 700, heal: 0.07, effect: 'heal', vuln: 0.3, power: 48 }, { t: 'seekers', n: 14, speed: 12, power: 70, hits: 2, r: 0.7, gap: 60, life: 6000, steal: 0.01, at: 600 },
      { t: 'rings', from: 'self', n: 3, gap: 700, speed: 8.5, w: 1.6, power: 120, at: 900 }, { t: 'buff', dur: 9000, buff: { dmg: 0.3, regen: 0.04, red: 0.2 }, radius: 12 }] });

  // ═══ VOID SOVEREIGN — what the world is not ═══════════════════════════════════════════════════════════════════════════════════════════
  def(VS, 20, 'null_veil', 'Null Veil', { cd: 22000, mp: 30, cast: 250, power: 60, theme: 'void', col: '#a060ff', g: 'void',
    desc: 'Wrap yourself in nothing. For six seconds a field of void follows you: it takes away half of every blow aimed at you, throws half of it back at the attacker, and burns whatever it touches.',
    steps: [{ t: 'zone', from: 'self', r: 3.6, dur: 6000, tick: 500, effect: 'aegis', red: 0.5, reflect: 0.5, power: 60, follow: true }, { t: 'nova', from: 'self', r: 3.8, power: 60, stun: 700, at: 100 }] });
  def(VS, 35, 'black_spiral', 'Black Spiral', { cd: 14000, mp: 36, cast: 250, power: 38, theme: 'void', col: '#c080ff', g: 'void',
    desc: 'Bolts of nothing stream from you in a widening spiral, fourteen turns of them, piercing everything in their path.',
    steps: [{ t: 'shots', rep: { n: 14, gap: 105, turn: 0.46 }, count: 2, spread: 180, speed: 15, range: 11, radius: 0.3, pierce: 2, power: 38, vi: 'nullbolt', type: 'arcane', vfxEnd: 'null_pop' }] });
  def(VS, 50, 'the_maw', 'The Maw', { cd: 40000, mp: 56, cast: 600, power: 70, at: 'cursor', range: 9, theme: 'eye', col: '#b070ff', g: 'void',
    desc: 'Open an eye in the world. For seven seconds it drags everything near toward it and chews at them; when it closes it collapses into a devastating, stunning blast.',
    steps: [{ t: 'totem', kind: 'maw', from: 'cursor', dur: 7000, every: 600, power: 70, range: 8, r: 8, pullR: 8, vi: 'nullbolt' }, { t: 'nova', from: 'cursor', r: 5.4, power: 210, stun: 1700, at: 7000 }] });
  def(VS, 70, 'unmake', 'Unmake', { cd: 34000, mp: 66, cast: 650, power: 200, theme: 'void', col: '#d090ff', g: 'void',
    desc: 'Name five enemies as things that should not be. After two seconds each of them stops existing: an enormous blast, which may unmake whatever was standing next to it.',
    steps: [{ t: 'bombs', count: 5, delay: 2000, r: 2.6, power: 200, cascade: 0.6 }, { t: 'rings', from: 'self', n: 2, gap: 500, speed: 9, w: 1.3, power: 70, at: 600 }] });
  def(VS, 90, 'the_last_dark', 'The Last Dark', { cd: 70000, mp: 92, cast: 900, power: 320, theme: 'void', col: '#8a50ff', g: 'void',
    desc: 'The end of light. A black vortex pulls the whole world into itself, six beams of nothing spin around you, four rings of darkness roll outward, and when it closes everything caught inside is erased for 320 power and stunned for two and a half seconds.',
    steps: [{ t: 'vortex', from: 'self', r: 10, pull: 7, dur: 3200, tick: 380, power: 70, then: { r: 8.2, power: 320, stun: 2500 } }, { t: 'beams', from: 'self', n: 6, len: 10.5, w: 1.3, spin: -1.2, dur: 3800, tick: 240, power: 58, follow: true, warn: 500, at: 300 },
      { t: 'rings', from: 'self', n: 4, gap: 650, speed: 8.5, w: 1.5, power: 110, at: 900 }, { t: 'buff', dur: 8000, buff: { dmg: 0.4 } }] });

  // ═══ TITAN FORGEMASTER — the first hammer-blow ════════════════════════════════════════════════════════════════════════════════════════
  def(TF, 20, 'slag_pit', 'Slag Pit', { cd: 16000, mp: 32, cast: 450, power: 120, at: 'cursor', range: 8, theme: 'ember', col: '#ff8a2a', type: 'blunt', g: 'flame',
    desc: 'Crack the ground open: a lake of liquid slag burns everything inside for six seconds and makes it 25% more vulnerable, and the hammer-blow that opened it stuns.',
    steps: [{ t: 'nova', from: 'cursor', r: 3.6, power: 120, stun: 1200 }, { t: 'zone', from: 'cursor', r: 4, dur: 6000, tick: 350, effect: 'burn', power: 48, vuln: 0.25, at: 200 }] });
  def(TF, 35, 'hammer_orbit', 'Titan\'s Hammers', { cd: 24000, mp: 40, cast: 300, power: 70, theme: 'hammer', col: '#ff8a2a', type: 'blunt', g: 'anvil',
    desc: 'Three rune-hammers of the forge circle you for ten seconds, smashing everything they pass, while the weight of them hardens you against harm.',
    steps: [{ t: 'orbit', n: 3, R: 2.7, dur: 10000, tick: 380, power: 70, r: 1.0, spin: 2.6 }, { t: 'buff', dur: 10000, buff: { red: 0.25, dmg: 0.15 } }] });
  def(TF, 50, 'furnace_totem', 'Furnace Totem', { cd: 42000, mp: 56, cast: 550, power: 90, at: 'cursor', range: 7, theme: 'ember', col: '#ff8a2a', type: 'arcane', g: 'flame',
    desc: 'Raise a roaring furnace. For sixteen seconds it hurls molten shot at the nearest enemy and every ally near it is mended and hits 25% harder.',
    steps: [{ t: 'totem', kind: 'furnace', from: 'cursor', dur: 16000, every: 800, power: 90, range: 9, r: 7, aura: { heal: 0.02, dmg: 0.25 }, vi: 'molten', aoe: 1.3 }] });
  def(TF, 70, 'colossus_fall', 'Colossus Fall', { cd: 38000, mp: 68, cast: 400, power: 220, theme: 'ember', col: '#ffb060', type: 'blunt', g: 'anvil',
    desc: 'Leap and come down like a mountain: a huge stunning crater, two shockwaves, and a slag fire where you landed that makes enemies 30% more vulnerable.',
    steps: [{ t: 'leap', dist: 9, power: 220, r: 4.8, stun: 1800, rings: 2 }, { t: 'zone', from: 'self', r: 4, dur: 5000, tick: 400, effect: 'burn', power: 45, vuln: 0.3, at: 520 }] });
  def(TF, 90, 'world_forge', 'The World Forge', { cd: 72000, mp: 92, cast: 800, power: 260, theme: 'ember', col: '#ffd070', type: 'arcane', g: 'flame',
    desc: 'You strike the anvil of the world. A furnace the size of a house rises beside you, molten meteors rain over the whole field, four beams of white-hot metal circle you, and for ten seconds you are a colossus: +50% damage, 30% less damage taken.',
    steps: [{ t: 'totem', kind: 'furnace', from: 'self', dur: 12000, every: 700, power: 100, range: 11, r: 9, aura: { heal: 0.03, dmg: 0.3 }, vi: 'molten', aoe: 1.6 }, { t: 'rain', from: 'self', n: 18, area: 8, over: 4000, r: 1.8, power: 120, warn: 700, fall: 'meteor', at: 400 },
      { t: 'beams', from: 'self', n: 4, len: 9.5, w: 1.5, spin: 1.3, dur: 5000, tick: 240, power: 70, follow: true, warn: 400, at: 300 }, { t: 'buff', dur: 10000, buff: { dmg: 0.5, red: 0.3 }, radius: 10 }, { t: 'nova', from: 'self', r: 6.5, power: 260, stun: 1500, at: 4400 }] });

  // ═══ PHILOSOPHER — the cure for everything ════════════════════════════════════════════════════════════════════════════════════════════
  def(PH, 20, 'mercury_rain', 'Mercury Rain', { cd: 14000, mp: 30, cast: 350, power: 50, at: 'cursor', range: 9, theme: 'potion', col: '#e8f0ff', g: 'drop',
    desc: 'Liquid mercury falls over an area: it burns enemies and falls just as readily on your allies, healing them.',
    steps: [{ t: 'rain', from: 'cursor', n: 14, area: 4.2, over: 2000, r: 1.4, power: 50, warn: 550, fall: 'drop', healAllies: 0.03 }] });
  def(PH, 35, 'transmutation_circle', 'Transmutation Circle', { cd: 26000, mp: 44, cast: 500, power: 45, theme: 'gem', col: '#ffd36a', g: 'drop',
    desc: 'Draw the circle. Inside it enemies burn and are 20% more vulnerable; you and your allies are mended and take 25% less damage. Eight seconds of equivalent exchange.',
    steps: [{ t: 'zone', from: 'self', r: 4.6, dur: 8000, tick: 500, effect: 'aegis', heal: 0.035, red: 0.25, power: 45, vuln: 0.2 }] });
  def(PH, 50, 'homunculus_legion', 'Homunculus Legion', { cd: 42000, mp: 58, cast: 600, power: 62, theme: 'potion', col: '#ffd36a', g: 'drop',
    desc: 'Four golden homunculi spring from the cauldron and bombard everything with flasks of living metal for eighteen seconds.',
    steps: [{ t: 'summon', kind: 'homunculus', n: 4, dur: 18000, power: 62, every: 850, range: 9, vi: 'aurum', aoe: 1.5, col: '#ffd36a' }] });
  def(PH, 70, 'five_essences', 'Five Essences', { cd: 34000, mp: 64, cast: 500, power: 66, theme: 'gem', col: '#ffe9a8', g: 'star',
    desc: 'Five orbs of quintessence circle you for twelve seconds. They burn every enemy they pass and mend every ally they pass, and the quintessence sharpens your mind.',
    steps: [{ t: 'orbit', n: 5, R: 3.4, dur: 12000, tick: 420, power: 66, r: 0.95, spin: 2.2, heal: 0.04 }, { t: 'buff', dur: 12000, buff: { mpRegen: 4, dmg: 0.25 }, radius: 8 }] });
  def(PH, 90, 'opus_magnum', 'Opus Magnum', { cd: 70000, mp: 90, cast: 900, power: 300, theme: 'gem', col: '#fff0a8', g: 'sun',
    desc: 'The Philosopher\'s Stone. The whole party is healed by 70% and made unbreakable (30% less damage, 60% more damage) for ten seconds; gold falls from the sky, healing allies where it lands, and the Stone detonates for 300 power.',
    steps: [{ t: 'heal', pct: 0.7, radius: 12 }, { t: 'buff', dur: 10000, buff: { dmg: 0.6, red: 0.3, regen: 0.04 }, radius: 12 }, { t: 'rain', from: 'self', n: 26, area: 7.5, over: 4200, r: 1.4, power: 90, warn: 650, fall: 'coin', healAllies: 0.03, at: 300 },
      { t: 'seekers', n: 10, speed: 12, power: 80, hits: 2, r: 0.7, gap: 60, life: 5000, steal: 0.012, at: 500 }, { t: 'nova', from: 'self', r: 6.8, power: 300, stun: 1600, at: 900 }] });

  // ═══ GILDED SOVEREIGN — the market bows ═══════════════════════════════════════════════════════════════════════════════════════════════
  def(GI, 20, 'gold_fall', 'Gold Fall', { cd: 14000, mp: 30, cast: 350, power: 56, at: 'cursor', range: 9, theme: 'coin', col: '#ffe36b', type: 'pierce', g: 'coin',
    desc: 'It rains gold on the target: fourteen heavy ingots in a cloudburst, each leaving a crater of splinters.',
    steps: [{ t: 'rain', from: 'cursor', n: 14, area: 4.4, over: 1900, r: 1.4, power: 56, warn: 550, fall: 'coin' }] });
  def(GI, 35, 'tithe', 'Tithe', { cd: 20000, mp: 40, cast: 400, power: 84, theme: 'crown', col: '#ffd36a', type: 'pierce', g: 'coin',
    desc: 'The crown collects. Three waves of royal gold roll out from you; each enemy they cross pays a tithe that heals you.',
    steps: [{ t: 'rings', from: 'self', n: 3, gap: 550, speed: 9, w: 1.5, power: 84, steal: 0.03 }] });
  def(GI, 50, 'vault_guard', 'Vault Guard', { cd: 40000, mp: 56, cast: 550, power: 85, at: 'cursor', range: 7, theme: 'coin', col: '#ffd36a', type: 'pierce', g: 'coin',
    desc: 'Summon a living vault. For sixteen seconds it showers the nearest enemy with gold and everyone near it takes 25% less damage.',
    steps: [{ t: 'totem', kind: 'vault', from: 'cursor', dur: 16000, every: 650, power: 85, range: 9, r: 7, aura: { red: 0.25 }, vi: 'gcoin' }] });
  def(GI, 70, 'bounty', 'Bounty', { cd: 34000, mp: 66, cast: 500, power: 100, theme: 'crown', col: '#ffe36b', type: 'pierce', g: 'coin',
    desc: 'Put a price on six heads. Each marked enemy is 30% more vulnerable and, after two seconds, the bounty is collected in an explosion that spreads to the enemies around it; a rain of gold pays out the rest.',
    steps: [{ t: 'mark', from: 'self', r: 10, v: 0.3, ms: 6000 }, { t: 'bombs', count: 6, delay: 2000, r: 2.4, power: 230, cascade: 0.5 }, { t: 'rain', from: 'self', n: 12, area: 6.5, over: 2600, r: 1.2, power: 80, warn: 600, fall: 'coin', at: 1400 }] });
  def(GI, 90, 'the_treasury', 'The Treasury', { cd: 72000, mp: 94, cast: 800, power: 280, theme: 'crown', col: '#ffe36b', type: 'pierce', g: 'coin',
    desc: 'Open the Treasury. Everyone in reach is locked in place and takes 40% more damage; six beams of molten gold sweep round you, thirty coins crash down and the whole vault detonates. You hit 50% harder for ten seconds.',
    steps: [{ t: 'zone', from: 'self', r: 8, dur: 8000, tick: 450, effect: 'slow', hold: 500, vuln: 0.4, power: 40, follow: true }, { t: 'beams', from: 'self', n: 6, len: 9.5, w: 1.4, spin: 1.4, dur: 5000, tick: 240, power: 62, follow: true, warn: 400, at: 250 },
      { t: 'rain', from: 'self', n: 30, area: 7.5, over: 4600, r: 1.4, power: 85, warn: 650, fall: 'coin', at: 500 }, { t: 'buff', dur: 10000, buff: { dmg: 0.5, red: 0.2 } }, { t: 'nova', from: 'self', r: 7.5, power: 280, stun: 1600, at: 7600 }] });
}
