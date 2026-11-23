// ─────────────────────────────────────────────────────────────────────────────
// HIDDEN QUESTS — nothing here is announced. There is no quest giver and no marker; the world gives
// clues (rumours, inscriptions, odd places) and the journal fills in only after you do something.
//
// A step is completed by exactly one of:
//   search: <qs>   press E on an invisible search spot (stand on the right tile) · optional night / dawn / have / stat / pay
//   touch:  <qs>   interact with a hidden point that is only visible once you are on this step
//   seq:    [..]   touch the points (qs) in this order — a wrong touch hurts and resets the sequence
//   kill:   <key>  defeat that enemy
// Optional on a step: travel [map,x,y] · give {item:n} · flag · claim <mythic id> · reward {...}
// ─────────────────────────────────────────────────────────────────────────────
import { dayPhase } from './world.js';

export const FIGHTER_CLASSES = ['warrior', 'mage', 'archer', 'archivist', 'desperado'];
export const isDawn = (now) => { const p = dayPhase(now); return p >= 0.93 || p < 0.1; };

export const QUESTS = {
  // ── Yggdrasil's Apostle ────────────────────────────────────────────────────────────────────────────────
  apostle: { title: 'The Root That Remembers', mythic: 'apostle', minLevel: 20, classes: FIGHTER_CLASSES, steps: [
    { id: 'well', search: 'well', night: true, hintNo: 'The well gives back only your reflection. Perhaps it is shy in daylight.',
      msg: 'You lean over the well at the dead of night. The water does not shake. It simply stops being water, and a shaft of pale roots spirals down into the dark.', log: 'At night the old well in Lanternfall opens onto a shaft of roots.' },
    { id: 'door', touch: 'door', travel: ['root_cellar', 20.5, 29.5], msg: 'You climb down the roots. The air is cold, green and alive.', log: 'Beneath the town lies a Root Cellar.' },
    { id: 'read', touch: 'inscription', msg: 'The roots have grown into letters: "THE ROOT WAKES AS THE SUN WALKS. WHERE IT RISES. WHERE IT STANDS HIGH. WHERE IT SETS. WHERE IT SLEEPS."', log: 'A root-carved riddle: the root wakes as the sun walks — rises, stands high, sets, sleeps.' },
    { id: 'stones', seq: ['e', 's', 'w', 'n'], qs: 'stone', msg: 'The last stone sinks into the floor. Far to the north, something heavy rolls aside.', log: 'Four root-stones answer to the path of the sun. The Living Gate is open.', wrong: 'The root lashes out — the stones go quiet. The sequence is wrong.' },
    { id: 'gate', touch: 'gate', travel: ['root_cellar', 20.5, 5.5], msg: 'You step through a doorway that is mostly a tree. Something enormous breathes in the dark.', log: 'Beyond the Living Gate waits a guardian of root and bark.' },
    { id: 'warden', kill: 'root_warden', give: { heartwood_seed: 1 }, flag: 'apostleSeed', msg: 'The Rootwarden collapses into a pile of kindling. In the ash, a warm seed pulses like a small heart.', log: 'The Rootwarden left a Heartwood Seed. It wants to be planted where the forest is thinnest — at first light.' },
    { id: 'plant', search: 'plant', dawn: true, have: { heartwood_seed: 1 }, consume: true, hintNo: 'The ground is willing. The light is not. Not yet.',
      msg: 'You press the seed into the cold soil as the first light touches the pond. The ground shudders. A sapling stands where there was none — and keeps growing.', log: 'The Heartwood Seed took root in Gloomwood. A sapling there opens a way up.' },
    { id: 'sapling', touch: 'treeportal', travel: ['world_tree', 22.5, 32.5], msg: 'The sapling is a doorway now. You walk up through the bark.', log: 'The sapling leads up into a vast tree: Yggdrasil\'s Crown.' },
    { id: 'guardian', kill: 'withered_guardian', msg: 'The Withered Guardian bows its antlers and comes apart like a late-autumn leaf. The Heartwood Altar blooms.', log: 'The Withered Guardian is dead. The Altar is ready for one worthy person.' },
    { id: 'claim', touch: 'altar', claim: 'apostle', msg: 'You lay your palm on the Heartwood Altar.' },
  ] },

  // ── Void Sovereign ──────────────────────────────────────────────────────────────────────────────────────
  void: { title: 'A Crown Cut From Nothing', mythic: 'void_sovereign', minLevel: 22, classes: FIGHTER_CLASSES, steps: [
    { id: 'obelisk', search: 'obelisk', have: { echo_shard: 5 }, consume: true, hintNo: 'The air by the northern obelisk hums a note. It wants something that is only an echo.',
      msg: 'You press five Echo Shards against the obelisk. It drinks them. Where the air was, a wound opens: a gate to somewhere that is not.', log: 'Five echoes bought a gate in the Depths.' },
    { id: 'gate', touch: 'gate', travel: ['void_rift', 24.5, 32.5], msg: 'You step into the Rift. The floor is a suggestion.', log: 'The Void Rift: islands floating in absolute dark.' },
    { id: 'king', kill: 'rift_king', msg: 'The Rift King unravels. The throne, empty, turns to look at you.', log: 'The Rift King is dead. His throne waits.' },
    { id: 'claim', touch: 'throne', claim: 'void_sovereign', msg: 'You sit on the throne. It does not resist.' },
  ] },

  // ── Titan Forgemaster (Blacksmith) ───────────────────────────────────────────────────────────────────
  titan: { title: 'The First Forge', mythic: 'titan_forgemaster', minLevel: 22, classes: ['blacksmith', 'soulsmith'], steps: [
    { id: 'offer', touchPoint: 'quarry.coldforge', stat: { masterworks: 15 }, have: { starmetal: 3 }, consume: true, flag: 'recipe_titan_core',
      hintNo: 'The Cold Forge hums when you pass — as if it recognises the work, but wants more shards than you carry.',
      msg: 'You feed three starmetal shards to the Cold Forge. It shows you the shape of something, in the way a forge shows you things: a Titan Core.', log: 'The Cold Forge taught you to forge a Titan Core: starmetal, shadowsteel and echoes.' },
    { id: 'core', touchPoint: 'quarry.coldforge', have: { titan_core: 1 }, consume: true, claim: 'titan_forgemaster', msg: 'You set the Titan Core on the Cold Forge.' },
  ] },

  // ── Philosopher's Heir (Alchemist) ──────────────────────────────────────────────────────────────────
  philosopher: { title: 'Gold From Lead', mythic: 'philosopher', minLevel: 22, classes: ['alchemist', 'transmuter'], steps: [
    { id: 'altar', search: 'altar', stat: { perfectBrews: 15 }, flag: 'recipe_philosophers_stone', hintNo: 'The ground behind the cauldron smells faintly of gold. Faintly.',
      msg: 'A paving stone gives under your heel and a recipe unfolds in your head, as if it were always there: a stone that is cooked, never found.', log: 'You learned the Philosopher\'s Stone recipe: Shadow Ichor, Ghostbloom, Ink — at the cauldron.' },
    { id: 'stone', search: 'altar', have: { philosophers_stone: 1 }, consume: true, claim: 'philosopher', msg: 'You set the stone on the hidden altar.' },
  ] },

  // ── Gilded Sovereign (Merchant) ─────────────────────────────────────────────────────────────────────
  gilded: { title: 'The Market Bows', mythic: 'gilded', minLevel: 22, classes: ['merchant', 'broker'], steps: [
    { id: 'vault', search: 'vault', stat: { profit: 5000, haggleWins: 15 }, hintNo: 'The cobbles here ring slightly hollow. Perhaps you are not yet someone the market notices.',
      msg: 'A seam in the cobbles opens onto a vault door, polished by nobody. A plate reads: "TRIBUTE: TWENTY THOUSAND."', log: 'There is a vault beneath the Exchange. It wants a tribute of 20,000 gilt.' },
    { id: 'tribute', search: 'vault', pay: 20000, claim: 'gilded', msg: 'You pay the tribute. The door opens.' },
  ] },

  // ── Hidden skill quests (two, open to every class) ───────────────────────────────────────────────────
  vault: { title: 'The Weeping Wall', minLevel: 8, classes: null, steps: [
    { id: 'wall', search: 'wall', hintNo: null, msg: 'You rap on the wall. It answers with a hollow knock. A crack opens like a mouth.', log: 'A cracked wall in the south-west of the Quarry hides a passage.' },
    { id: 'door', touch: 'door', travel: ['sunken_vault', 15.5, 21.5], msg: 'Cold air, old stone.', log: 'The Sunken Vault.' },
    { id: 'read', touch: 'inscription', msg: 'Worn letters: "THIRD WAKES THE VAULT. THEN THE FIRST. THE SECOND SEALS IT."', log: 'Riddle: Third, then First, then Second.' },
    { id: 'plates', seq: [3, 1, 2], qs: 'plate', msg: 'Stone grinds on stone. The sealed room beyond opens.', log: 'The three plates yielded.', wrong: 'The plates snap back up. Wrong order.' },
    { id: 'treasure', touch: 'treasure', reward: { hq: 'vault', gilt: 600, title: 'Vault Delver' }, msg: 'The chest holds a manual of forgotten technique.' },
  ] },
  bell: { title: 'The Ringer\'s Bell', minLevel: 10, classes: null, steps: [
    { id: 'grave', search: 'grave', night: true, hintNo: null, msg: 'A moss-covered grave marker is carved with a bell. Under it, a note: "BURIED WITHOUT HIS BELL. IT LIES WHERE WORDS DROWN."', log: 'The Ringer was buried without his bell. It lies where words drown.' },
    { id: 'bell', search: 'bell', msg: 'Beneath the sodden shelves: a bell with no clapper, wrapped in rags. You can almost hear it.', log: 'You found the Silent Bell in the Drowned Archive.' },
    { id: 'ring', touch: 'ring', count: 3, gap: 6000, reward: { hq: 'bell', gilt: 500, title: 'Ringer' }, msg: 'You strike the bell. It rings, though it has no sound.' },
  ] },
};

export const stepIndex = (P, qid) => P.quests?.[qid]?.step ?? 0;
export const questDone = (P, qid) => !!P.quests?.[qid]?.done;
export const classOk = (P, q) => !q.classes || q.classes.includes(P.classId);
export const eligible = (P, q) => classOk(P, q) && P.level >= (q.minLevel ?? 1);

// Index of the first step that needs a point with this `qs` (touch / seq); a point is visible once you are that far.
export function firstStepFor(q, p) {
  return q.steps.findIndex((s) => (s.touch && s.touch === p.qs) || (s.seq && s.qs === p.qs) || (s.touchPoint && s.touchPoint === p.id));
}
export function questPointVisible(P, p) {
  const q = QUESTS[p.q]; if (!q || !eligible(P, q)) return false;
  const i = firstStepFor(q, p); return i >= 0 && stepIndex(P, p.q) >= i;
}
