import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GEN_DIR = join(ROOT, '..', 'imcs-generation');

const config = JSON.parse(readFileSync(join(GEN_DIR, 'config.json'), 'utf-8'));

const EQUIPPABLE_LAYERS = 10; // skip noise (layer 10)
const SLOT_NAMES = ['BGS', 'BODS', 'CLOTHS', 'SPESHUL', 'AYEZZ', 'MOUFS', 'FACESSORIES', 'HATSS', 'EXTRUHS', 'TEXTUH'];
const REQUIRED_SLOTS = [0, 1, 4]; // BGS, BODS, AYEZZ

const layers = [];
const traits = {};
const hiddenTraits = {};
let totalVisible = 0;
let totalHidden = 0;

for (let i = 0; i < EQUIPPABLE_LAYERS; i++) {
  const layer = config.layers[i];
  const layerInfo = {
    index: i,
    name: layer.name,
    slot: SLOT_NAMES[i],
    required: REQUIRED_SLOTS.includes(i),
    traitCount: layer.traits.length,
    visibleCount: layer.traits.filter(t => !t.hidden).length,
  };
  layers.push(layerInfo);

  for (let j = 0; j < layer.traits.length; j++) {
    const trait = layer.traits[j];
    const traitId = i * 1000 + j + 1;

    traits[traitId] = {
      traitId,
      layer: i,
      layerName: layer.name,
      slot: SLOT_NAMES[i],
      index: j,
      name: trait.displayName,
      filename: trait.filename,
      rarity: trait.rarity,
      hidden: trait.hidden,
    };

    if (trait.hidden) {
      hiddenTraits[i] = traitId;
      totalHidden++;
    } else {
      totalVisible++;
    }
  }
}

// Convert trait links from config (filename-based) to traitId-based
function findTraitId(layerName, traitName) {
  const layerIndex = config.layers.findIndex(l => l.name === layerName);
  if (layerIndex === -1 || layerIndex >= EQUIPPABLE_LAYERS) return null;
  const traitIndex = config.layers[layerIndex].traits.findIndex(
    t => t.displayName === traitName || t.filename === traitName || t.filename === traitName + '.png'
  );
  if (traitIndex === -1) return null;
  return layerIndex * 1000 + traitIndex + 1;
}

const traitLinks = (config.traitLinks || []).map(link => {
  const triggerTraitName = link.trigger.trait.replace('.png', '');
  const requiredTraitName = link.required.trait.replace('.png', '');
  const triggerId = findTraitId(link.trigger.layer, triggerTraitName);
  const requiredId = findTraitId(link.required.layer, requiredTraitName);

  return {
    triggerLayer: link.trigger.layer,
    triggerTrait: triggerTraitName,
    triggerTraitId: triggerId,
    requiredLayer: link.required.layer,
    requiredTrait: requiredTraitName,
    requiredTraitId: requiredId,
  };
}).filter(l => l.triggerTraitId !== null && l.requiredTraitId !== null);

const traitExclusions = (config.traitExclusions || []).map(exc => {
  const trait1Name = exc.trait1.trait.replace('.png', '');
  const trait2Name = exc.trait2.trait.replace('.png', '');
  const trait1Id = findTraitId(exc.trait1.layer, trait1Name);
  const trait2Id = findTraitId(exc.trait2.layer, trait2Name);

  return {
    layer1: exc.trait1.layer,
    trait1: trait1Name,
    trait1Id: trait1Id,
    layer2: exc.trait2.layer,
    trait2: trait2Name,
    trait2Id: trait2Id,
  };
}).filter(e => e.trait1Id !== null && e.trait2Id !== null);

// ---------------------------------------------------------------------------
// NEW TRAITS (post-launch, pack-distributed). Appended after original indices.
// Art lives in imcs-generation/new-traits/. No rarity. Supply from
// new-traits-count.md (hardcoded below, keyed by filename basename).
// Extruhs carry derk/lyte/ayeliun body variants -> 3 trait IDs each + body link.
// ---------------------------------------------------------------------------
import { readdirSync, statSync } from 'fs';

const NEW_DIR = join(GEN_DIR, 'new-traits');
const BODY_VARIANTS = ['derk', 'lyte', 'ayeliun'];

// supply totals per filename basename (extruh keys are the sub-dir base name)
const SUPPLY = {
  "bg's": { 'peekah suhprize': 12, 'wp2808001': 12 },
  cloths: { hoodid: 15, 'rohb ov meemz': 44, blasstoyce: 8, saaluhmandurr: 12, majishun: 33, 'monies sewt': 33, ched: 111 },
  ayezz: { deemon: 55, 'crii baybee': 69, susss: 49 },
  moufs: { beerd: 77, 'raynboh deemon grell': 55, umph: 121, smuurk: 111 },
  extruhs: { 'ban hammur': 69, 'explooror staaf': 33, spuun: 101 },
  hatss: { doge: 60, 'nurow leenk': 27 },
};

// body distribution across the 4269 collection -> split extruh supply by demand
const tokenTraits = JSON.parse(readFileSync(join(ROOT, 'data', 'token-traits.json'), 'utf-8'));
const bodyNameToId = {};
for (const id in traits) {
  if (traits[id].layer === 1) bodyNameToId[traits[id].name.toLowerCase()] = traits[id].traitId;
}
const bodyCounts = { derk: 0, lyte: 0, ayeliun: 0 };
const idToBodyName = Object.fromEntries(Object.entries(bodyNameToId).map(([n, i]) => [i, n]));
for (const t in tokenTraits) {
  const bn = idToBodyName[tokenTraits[t][1]];
  if (bn && bodyCounts[bn] !== undefined) bodyCounts[bn]++;
}
const bodyTotal = bodyCounts.derk + bodyCounts.lyte + bodyCounts.ayeliun;

function splitByBody(total) {
  const out = {};
  let used = 0;
  for (const b of BODY_VARIANTS) {
    out[b] = Math.round(total * (bodyCounts[b] / bodyTotal));
    used += out[b];
  }
  out.derk += total - used; // absorb rounding remainder
  return out;
}

const nextIndex = {};
for (const id in traits) {
  const L = traits[id].layer;
  nextIndex[L] = Math.max(nextIndex[L] ?? -1, traits[id].index);
}

const newTraitSupply = {}; // traitId -> amount to mint
const layerNameToIndex = Object.fromEntries(layers.map(l => [l.name, l.index]));

function addNewTrait(layerName, name, newPath, supply, bodyName) {
  const L = layerNameToIndex[layerName];
  const index = (nextIndex[L] = (nextIndex[L] ?? -1) + 1);
  const traitId = L * 1000 + index + 1;
  traits[traitId] = {
    traitId, layer: L, layerName, slot: SLOT_NAMES[L], index,
    name, filename: newPath.split('/').pop(), rarity: 0, hidden: false,
    isNew: true, newPath,
  };
  newTraitSupply[traitId] = supply;
  if (bodyName) {
    const requiredTraitId = bodyNameToId[bodyName];
    traitLinks.push({
      triggerLayer: 'extruhs', triggerTrait: name, triggerTraitId: traitId,
      requiredLayer: 'bods', requiredTrait: bodyName, requiredTraitId,
    });
  }
  return traitId;
}

for (const layerName of readdirSync(NEW_DIR)) {
  if (layerName.startsWith('.')) continue;
  const layerPath = join(NEW_DIR, layerName);
  if (!statSync(layerPath).isDirectory()) continue;
  for (const entry of readdirSync(layerPath)) {
    if (entry.startsWith('.')) continue;
    const entryPath = join(layerPath, entry);
    if (statSync(entryPath).isDirectory()) {
      // extruh body-variant trait -> 3 IDs
      const base = entry;
      const total = SUPPLY[layerName]?.[base] ?? 0;
      const split = splitByBody(total);
      for (const body of BODY_VARIANTS) {
        addNewTrait(layerName, `${base} ${body}`, `${layerName}/${base}/${body}.png`, split[body], body);
      }
    } else if (entry.endsWith('.png')) {
      const base = entry.replace('.png', '');
      const supply = SUPPLY[layerName]?.[base] ?? 0;
      addNewTrait(layerName, base, `${layerName}/${entry}`, supply);
    }
  }
}

const output = {
  layers,
  traits,
  hiddenTraits,
  traitLinks,
  traitExclusions,
  stats: {
    totalLayers: EQUIPPABLE_LAYERS,
    totalTraits: totalVisible + totalHidden,
    visibleTraits: totalVisible,
    hiddenTraits: totalHidden,
    requiredSlots: REQUIRED_SLOTS,
  },
};

const outputPath = join(ROOT, 'data', 'trait-map.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));

// New-trait mint batch (for testnet mint to dev wallet / mainnet pack pool).
const newIds = Object.keys(newTraitSupply).map(Number).sort((a, b) => a - b);
const newSupplyOut = {
  generatedAt: new Date().toISOString(),
  bodyCounts,
  mintBatch: { traitIds: newIds, amounts: newIds.map(id => newTraitSupply[id]) },
  traits: newIds.map(id => ({ traitId: id, name: traits[id].name, layerName: traits[id].layerName, newPath: traits[id].newPath, supply: newTraitSupply[id] })),
  totalNewTypes: newIds.length,
  totalNewInstances: newIds.reduce((s, id) => s + newTraitSupply[id], 0),
};
writeFileSync(join(ROOT, 'data', 'new-trait-supply.json'), JSON.stringify(newSupplyOut, null, 2));
console.log(`New-trait supply: ${newSupplyOut.totalNewTypes} types, ${newSupplyOut.totalNewInstances} instances -> data/new-trait-supply.json`);
console.log(`  body split basis:`, bodyCounts);

console.log(`Trait map generated: ${outputPath}`);
console.log(`  Layers: ${EQUIPPABLE_LAYERS}`);
console.log(`  Visible traits: ${totalVisible}`);
console.log(`  Hidden traits: ${totalHidden}`);
console.log(`  Trait links: ${traitLinks.length}`);
console.log(`  Trait exclusions: ${traitExclusions.length}`);
console.log(`  Hidden trait IDs per layer:`, hiddenTraits);
