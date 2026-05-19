import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const METADATA_DIR = join(ROOT, '..', 'imcs-generation', 'OUTPUT', 'metadata');

const traitMap = JSON.parse(readFileSync(join(ROOT, 'data', 'trait-map.json'), 'utf-8'));
const EQUIPPABLE_LAYERS = 10;

const files = readdirSync(METADATA_DIR).filter(f => f.endsWith('.json'));
console.log(`Processing ${files.length} metadata files...`);

const tokenTraits = {};
let processed = 0;

for (const file of files) {
  const metadata = JSON.parse(readFileSync(join(METADATA_DIR, file), 'utf-8'));
  const tokenId = metadata.edition;
  const dna = metadata.dna.split('-').map(Number);

  const slots = new Array(EQUIPPABLE_LAYERS);
  for (let layer = 0; layer < EQUIPPABLE_LAYERS; layer++) {
    const traitIndex = dna[layer];
    const traitId = layer * 1000 + traitIndex;
    const trait = traitMap.traits[traitId];

    if (trait && trait.hidden) {
      slots[layer] = 0;
    } else {
      slots[layer] = traitId;
    }
  }

  tokenTraits[tokenId] = slots;
  processed++;
}

const sortedKeys = Object.keys(tokenTraits).map(Number).sort((a, b) => a - b);
const sorted = {};
for (const k of sortedKeys) {
  sorted[k] = tokenTraits[k];
}

writeFileSync(join(ROOT, 'data', 'token-traits.json'), JSON.stringify(sorted, null, 2));

console.log(`Token traits generated: ${processed} tokens`);
console.log(`Sample token #1: [${sorted[1].join(', ')}]`);
console.log(`Sample token #42: [${sorted[42].join(', ')}]`);
