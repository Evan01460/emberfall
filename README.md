# Emberfall

A classic fantasy action RPG you can play **solo or online**: real-time combat, a player-driven crafting economy,
six classes that **Ascend** into specialised paths, hidden classes, five one-of-a-kind **mythic** classes, a large
open world, hidden quests, guilds, a world boss and a party raid. **Everything on screen is pixel art** — tiles, props,
characters, monsters, icons, attack effects, text and UI are drawn in code as pixels, with an embedded pixel font, a procedurally generated chiptune score for every kind of place, and synthesised sound effects.

## Run it

```bash
npm install
npm start            # online server + game at http://localhost:8080
npm test             # 89 tests
npm run build        # → dist/emberfall.html : one self-contained file, solo mode, double-click to play
```

Pick **Solo** (a private world stored in your browser) or go **Online**:

* **One global public world — no setup.** Everybody who chooses *Online · Public world* meets in the **same** world, on any network. The first player in becomes its host *from their browser* (it runs the same authoritative game server the Node host runs); everyone else joins over WebRTC through PeerJS's free public matchmaking broker, with STUN and public **TURN relays** configured so it works across different Wi-Fi networks, mobile data and strict NATs (override with your own TURN via `localStorage['emberfall-ice']`). Big messages are chunked, the game version is checked (builds with different protocols never share a world), a heartbeat reports a silent host, and when the host leaves the next arrival carries the world on from the latest backup. **Your character is also kept privately in your own browser** and is restored (passphrase-checked) if the world you last played in is lost.
* **An always-on global server (recommended).** A browser-hosted world only exists while its host has the page open. For one persistent world everybody shares, run the Node host (`npm start`, or the Dockerfile) on an always-on machine — **[DEPLOY.md](DEPLOY.md) walks through free hosting on Render in about five minutes** (`render.yaml` and `fly.toml` are included). Visitors of that URL who pick *Public world* automatically join it, and `EMBERFALL_GLOBAL_WS=wss://your.host/ws npm run build` bakes the address into the downloadable file. Characters are saved on the server, and on free hosting whose disk is wiped on restart every player's browser also keeps a copy **signed by the server** (`VAULT_SECRET`) that restores their character *and returns whatever the market was holding for them* (listings, order and request escrow). Optionally set `BACKUP_GIST_ID` + `BACKUP_GITHUB_TOKEN` to back the whole world up to a private gist (see DEPLOY.md).
* **My own server:** `npm start`, then anyone who can reach it opens the same address and creates a character with a passphrase. Docker: `docker build -t emberfall . && docker run -d -p 8080:8080 -v emberfall-data:/data emberfall`.
Put it behind HTTPS and the client uses `wss://` automatically. State autosaves every 30 s and on shutdown. `GET /health` reports players online.

## Playing

| Input | Action |
|---|---|
| **WASD** | move |
| **Mouse** | aim · **left-click** (hold) basic attack — warriors chain a 3-hit combo, the last swing is the big one |
| **1 – 4** | your equipped skills (change them in Character → Skills) — **every action key is rebindable: press K** |
| **Space / Shift** | dodge roll (brief invulnerability) |
| **5 / 6 / 7** | health potion / mana potion / your custom flask or draught |
| **E** | interact: talk, gather, craft, trade, search containers, drink at wells, rest on benches. **Where nothing is shown, E searches.** |
| **I / J / H / M** | character · journal · help · sound & music on/off |
| **Enter** | chat (`say`, `global`, `party`, `guild`, `trade`; `/w name msg`) |
| **Right-click a player** | trade, party, duel, guild invite, whisper, request an item (crafters) |

Press **P** to toggle PvP. A short class-specific **tutorial** runs the first time a character enters the world (replay it from Help). Combat is real-time. Enemies telegraph every attack as a red shape on the ground — step out or roll through. **Fighting above your
level is punished**: you deal much less damage and take more, and an enemy you are plinking from range will break into a sprint to close the gap.

## Classes, Ascension and skills

Six base classes — **Warrior, Mage, Archer** (fighters) and **Blacksmith, Alchemist, Merchant** (trade classes; see the economy).

* **Ascension (level 8):** choose a path that reshapes stats, the basic attack and the skill kit — e.g. Warrior → **Mana Sword** (melee + magic, huge mana pool), **Brute** (slow, long reach, enormous HP and damage) or **Bulwark** (taunt, party heals); Mage → Pyromancer / Warlock / Sage; Archer → Ranger / Sniper / Windrunner; Blacksmith → Weaponsmith / Armorsmith; Alchemist → Apothecary / Bombardier; Merchant → Auctioneer / Caravan Master.
* **Mastery (level 20):** a second choice per path adds an ultimate. Un-ascending costs gilt.
* **Skills are learned, then equipped (4 slots), and only skills that fit your class can be equipped.** They come from levelling, from **Skill Tomes** dropped by enemies (class-restricted), from Ascension, and from hidden quests and places.
* **Hidden classes** replace your class (Archivist, Desperado, Broker, Soulsmith, Transmuter). Nobody tells you how to find them.
* **Mythic classes — only ONE player in the entire server can ever hold each:** Yggdrasil's Apostle, Void Sovereign, Titan Forgemaster, Philosopher's Heir, Gilded Sovereign. Each carries a unique status (World-Tree's Mantle regenerates and revives; Voidborn phases through hits; Midas' Ledger turns wealth into damage…). The quest chains are multi-step, hidden and hard: clues in rumours and inscriptions, places that only open at night or at dawn, puzzles that hurt when you get them wrong. The Hall of Legends records who claimed what.

## The world

A continent of 19 zones (~190,000 tiles) plus 8 dungeon floors: **Lanternfall** (hub), Whispering Quarry, Gloomwood, the Drowned Archive, and — procedurally generated, deterministic on server and client — **Greenmeadow** (village Hollowbrook), **Saltmere Coast** (harbour town), **Ironhold Mines**, **Mistfen Marsh**, **Sunscorch Dunes** (oasis, pyramid), **Frostpeak Highlands**, **The Emberwaste**, **Crystal Caverns** and the **Ruined Citadel**, plus the Shadowfell (a mirror world with its own market and mana drain) and a handful of places not on any map. Roads wind between villages, camps, ruins, towers, shrines and boss lairs; rivers have bridges; elites guard camps. **Waystones** in every zone fast-travel between the ones you have attuned (20g).

The world is physical and alive: furniture, anvils and NPCs have hitboxes; doors swing open; barrels, crates, shelves, graves and carts can be searched; wells heal; benches rest; fountains bless. There is a day/night cycle with pixel lamplight, rain, snow and embers by biome, footstep dust, NPCs that talk to passers-by, and sound effects.

## Crafting and the economy

Blacksmiths, Alchemists and Merchants **are** the economy.

* **Forging is three stages, all re-scored on the server:** **heat** — a thermometer starts in the middle of the gold zone and cools on its own; *hold Space* to push it up and let go to let it sink (it responds directly, with a gentle drift from the coals), keeping it centred for six seconds; **hammer** — strike on the sweet spot while the smith swings a real hammer on the anvil; then pick a quench bath (water → Keen, oil → Warded, brine → Lively) and dunk at the right moment.
* **Brewing:** choose up to two reagents, stir in rhythm (purity sets potion strength), then press-your-luck with catalysts.
* **Custom crafting:** instead of only fixed recipes, smiths and alchemists attach **effects** to what they make — a forge-time effect on gear (Keen, Vampiric, Thorned, Soulthirst, Starforged…), or custom **Draughts** (drunk), **Flasks** (thrown) and **Essences** with effects they choose. Each effect costs materials. **Level and mastery gate it**: a level-1 crafter cannot do it at all; slots and effect tiers grow with level, a Mastery adds a slot and unlocks tier 4. Better craftsmanship makes effects stronger and sloppy work can lose them — so there are effectively endless recipes.
* **Enchanting needs both classes:** only an Alchemist can brew an Essence; only a Blacksmith can pour it into gear at a forge — so the two trade (alchemists may hand Essences to smiths directly).
* ****Everything crafted is signed:** gear shows *forged by NAME* (and its effects) for everyone who sees it — in bags, trades, the Exchange and orders — and custom potions show *brewed by NAME*.
* **Crafters cannot list their own creations on the Exchange or sell them to the NPC vendor.** They fill **commissions** other players post, or sell to **Merchants**, who post **wholesale** buy orders at prices they choose and resell on the Exchange at any price. Orders are escrowed, refunded, and expire after 24 h; bot clients keep solo crafters supplied.
* **Direct requests (Character → Trading, or right-click a Blacksmith/Alchemist → Request an item):** you ask a specific crafter for an item at a payment you offer (held in escrow). You haggle in private chat (/w) and with formal counter-offers; the crafter **accepts or rejects** — if the item is beyond their level (or needs a recipe they lack) only *reject* is available. After accepting they either already own a fitting item or make it, press **Ready** (you are told), and **Deliver**: the item moves to you and the escrow pays them. Rejecting or cancelling just refunds the escrow. **This is the only way crafters sell directly to non-merchants** — anything else they make sells through Merchants.
* One shared Exchange per realm with price discovery, simulated shoppers and arbitrage merchants; direct two-sided trading; parties; consensual duels.

## Online content

* **Dungeons:** four two-floor dungeons entered through cave mouths in the overworld — **Goblin Warrens** (Greenmeadow), **Sunken Crypt** (Mistfen), **Frozen Catacombs** (Frostpeak) and **Magma Depths** (Emberwaste). Rooms-and-corridors layouts, always dark (carry your own light), elites in the side rooms, a stairwell down and a boss with a rich hoard on the last floor. The first boss kill of each dungeon each day pays a bonus.
* **World boss:** the Cinder Colossus rises in a random zone every ~25 minutes, announced to everyone; it scales with the crowd and rewards every contributor.
* **The Ember Tyrant raid (level 20+):** a party enters Cinderhold Bastion through the Gatekeeper in the Emberwaste. Three phases (the brood, the furnace), adds, a wipe resets it, and every raider gets gilt, XP, a Tyrant-forged piece with a tier-3 effect, and a chance at a Skill Tome.
* **Bounty board** in Lanternfall: fresh daily bounties (kill / gather / craft) per player.
* **Guilds** (300g charter): roster, guild chat, name tag, message of the day, **guild levels** (earned by members' kills, bounties, deposits and raids — each level gives every member +2% XP), a **guild bank** (anyone deposits, the leader withdraws), and the **Guild Raid**: Guildmaster Orren in Lanternfall sends 3+ guild members (1 in a solo world) into the Titan's Crucible against the four-phase **Obsidian Titan** — molten adds, meteors that land where you stand (watch the red rings), Titan-forged gear with a tier-4 effect, a 3000g deposit to the bank, a 20-hour lockout per guild. 
* **PvP (press P):** an opt-in flag for level 5+. Two flagged players within 10 levels can fight each other outside safe zones (not party-mates or guild-mates); a PvP death costs no gilt, kills are counted, you cannot stand down for 15 s after a fight, and killing the same player again within 2 minutes earns nothing. Duels still exist for friendly fights.
* **Guild wars:** a guild leader declares war on another guild (both need 2+ members; the other leader must be online to accept). For 30 minutes — or until one side reaches 25 kills — enemy guild members can be attacked anywhere outside safe zones, flagged or not. **The winner takes 10% of the loser's guild bank.** A tie moves nothing; leaders may surrender (the other side wins); a disbanded guild forfeits; the same two guilds must wait an hour for a rematch. The war score and clock sit under your health bar, and the Guild tab shows the stakes (prize and risk), the record and the picker for declaring war.
* **Leaderboards** (Character → Journal → Leaderboards): **combat power**, **total money** (purse plus gilt held in your open orders) and **most valuable item**; one board for each of the **six main classes** (Warrior, Mage, Archer, Blacksmith, Alchemist, Merchant — hidden and mythic classes are never ranked); plus enemies felled, PvP victories, market takings, items crafted, raid clears, bounties and guild-war victories.

## How online works

```
browser ──WebSocket──▶ host/server.mjs ──▶ GameServer (src/server/*)  ← authoritative world, 20 ticks/s
browser (solo)  ─────────────────────────▶ the same GameServer, running in the page
```

The **server is authoritative**: it validates movement, runs every enemy, projectile and hit check, rolls loot, holds both markets, re-scores crafting minigames and executes trades atomically. Clients send intent and draw what the server reports.

```
src/data.js, skilldata.js   all content: classes, paths, skills, enemies, items, recipes, zones
src/loadout.js, custom.js   skills/loadouts/Ascension helpers; custom-crafting effects and gating
src/quests.js               the hidden quest chains
src/world.js                tile maps, the procedural zone generator, hidden places, day/night clock
src/rules.js, units.js      per-player rules, stats, damage formula, loot
src/economy.js              market simulation
src/server/gameserver.js    sessions, markets, trading, parties, chat
src/server/combat.js        real-time combat, skills, enemies, duels
src/server/progress.js      skills, Ascension, hidden quests, mythic registry, waystones, scenery
src/server/live.js          world boss, raid, bounties, guilds, leaderboards
src/server/pvp.js           PvP flag, kill credit, guild wars
src/client/p2p.js           zero-setup public worlds (WebRTC host/guest, host migration)
src/client/*                pixel renderer, sprites, icons, effects, UI, music, sound
host/server.mjs             Node host: static files, WebSocket, accounts (scrypt), autosave
```

## The Far Reaches, the Spire and the raids

Beyond the original continent lies a second one with **48 new regions** across 12 biomes (Ashen, Hoarfrost, Starlit, Sunbaked, Riftscarred, Celestial, Gilded and Primeval regions ...), reached by roads from the existing zones, **10 more dungeons** (multi-floor, with bosses), **482 new enemy types** and **8 new metal tiers** (Voidglass, Drakesteel, Celestine, Eternium, Nullsteel, Solarite, Mythril, Worldsteel — ore, ingots, recipes and gear for every class). The **level cap is now 100**; past level 30 each level takes longer and gives a little more damage.

* **The Endless Spire** — 120 floors, starting in Greenmeadow. Floor 1 is for beginners; the enemy level climbs with every floor, with a boss every few floors. Reaching floors 25 / 70 / 120 earns the titles Spire-Walker, Spire-Warden and Spire-Crowned.
* **Citadel of the Void Emperor** (level 40+, 4 wings) and **Wyrmcrown Sanctum** (level 80+, 5 wings) — real multi-boss raids entered from gatekeepers in the Far Reaches by a party standing together (a solo world lets one player try). Each wing is a separate boss fight with phases: servants, falling stars aimed at raiders, enrages, shields that hold while the boss's servants live, and twin bosses that must be killed close together. Every cleared wing pays gilt, XP and a chance at raid-forged gear with a powerful effect, tomes and starmetal; the last boss drops the best. If everyone falls the raid resets. Clearing them earns the titles Voidbreaker and Wyrmslayer.
* **Health scale:** all health is ten times larger (a starting warrior has ~300 HP), enemy damage was raised to match, shields and the old potions scale too, and the new percentage potions (Greater Marrow Tonic ... Supreme Elixir, Mana Surge, Grand Mana) heal a share of your maximum. Damage dealt is unchanged, so life steal (a flat number) is roughly ten times weaker than before relative to your health.

## Known limits

* Balance was tuned with bots and unit tests, **not by human playtesting**; expect to adjust numbers in `src/data.js` and `src/skilldata.js`.
* The crafting minigames are verified server-side, but a determined client could script perfect timing.
* No account recovery, moderation tools or rate limiting beyond basic flood control and login throttling.
* One server process = one world shard (a few hundred players is realistic).
* All art, music and sound are generated in code. The public world depends on PeerJS's free public broker (not tested against it from the build sandbox — tested end-to-end against a local broker) and on a host being present; a published artifact page cannot open peer connections.

## What's new (latest)
* **Unique hidden and mythic skills**, stronger hidden-class basics, and **cinematics** for ascending, hidden classes and a different one for each mythic class.
* **Seven gear tiers** (new: Moonsilver, Cinderforged, Aetherium) with gear **made for every class** (+10% when it fits, shown on every item and in Character → Overview); honest prices; no gear from chests.
* **Three new regions and two new dungeons** with new enemies, bosses and ores.
* **Accepted bounties never expire**; customer orders can be promised and kept for 3 days.
* **Signature skill effects for every hidden and mythic skill** (`src/client/skillfx.js`): tumbling dice, spinning playing cards, a giant ace and a casino jackpot for the Desperado; ink strokes, flying words and a falling ink column for the Archivist; a gnarled-root eruption for the Apostle's Rootbind, a black hole for Event Horizon, and so on. Their damage is also 30% higher than before.
* **Desperado dice and card basic attack.** Before every attack except All In the Desperado rolls dice (one per shot) and each die's face multiplies that shot's base damage; the dice hover above the character for a couple of seconds. The basic attack throws spinning playing cards. Every hidden and mythic class's basic attack now has its own art (quills, banknotes, prism flasks, philosopher's stones, gilt coins, a root whip, a void edge...), and the hammer sprite was redrawn.
* **Item browser** in the crafting window and the request tab: search, category and metal filters, "craftable now" / "suits my class", sorting, icons, headline stats and ingredients on every card. Requests now show the selected item's details before you send them.
* **Brewing minigame reworked:** press Space to begin, a 3-2-1 countdown, a smooth marker, a result under every bell (perfect / early / late / miss), combo counter and live purity, and a clearer catalyst phase that shows your burst risk.
* **Class plates over every player** (base, ascended path, hidden gem, mythic crown) and **titles** earned from feats (Character > Journal) that you can wear above the plate.
