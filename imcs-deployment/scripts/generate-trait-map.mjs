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

console.log(`Trait map generated: ${outputPath}`);
console.log(`  Layers: ${EQUIPPABLE_LAYERS}`);
console.log(`  Visible traits: ${totalVisible}`);
console.log(`  Hidden traits: ${totalHidden}`);
console.log(`  Trait links: ${traitLinks.length}`);
console.log(`  Trait exclusions: ${traitExclusions.length}`);
console.log(`  Hidden trait IDs per layer:`, hiddenTraits);
