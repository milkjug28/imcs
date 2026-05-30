import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const tokenTraits = JSON.parse(readFileSync(join(ROOT, 'data', 'token-traits.json'), 'utf-8'));
const traitMap = JSON.parse(readFileSync(join(ROOT, 'data', 'trait-map.json'), 'utf-8'));

const supplyCounts = {};

for (const [tokenId, slots] of Object.entries(tokenTraits)) {
  for (const traitId of slots) {
    if (traitId === 0) continue; // hidden/empty slot
    supplyCounts[traitId] = (supplyCounts[traitId] || 0) + 1;
  }
}

const sortedEntries = Object.entries(supplyCounts)
  .map(([id, count]) => [Number(id), count])
  .sort((a, b) => a[0] - b[0]);

const sorted = Object.fromEntries(sortedEntries);

// Build arrays for batch minting (traitIds and amounts in matching order)
const mintTraitIds = sortedEntries.map(([id]) => id);
const mintAmounts = sortedEntries.map(([, count]) => count);

const totalSupply = mintAmounts.reduce((a, b) => a + b, 0);

const output = {
  supplyCounts: sorted,
  mintBatch: {
    traitIds: mintTraitIds,
    amounts: mintAmounts,
  },
  stats: {
    uniqueTraitTypes: mintTraitIds.length,
    totalTraitInstances: totalSupply,
    averageSupply: Math.round(totalSupply / mintTraitIds.length),
  },
};

writeFileSync(join(ROOT, 'data', 'trait-supply.json'), JSON.stringify(output, null, 2));

console.log(`Supply counts generated:`);
console.log(`  Unique trait types: ${mintTraitIds.length}`);
console.log(`  Total trait instances: ${totalSupply}`);
console.log(`  Average supply per trait: ${output.stats.averageSupply}`);

// Show top 5 rarest and most common
const byCount = sortedEntries.sort((a, b) => a[1] - b[1]);
console.log(`\n  5 rarest traits:`);
for (const [id, count] of byCount.slice(0, 5)) {
  const t = traitMap.traits[id];
  console.log(`    ${t.slot}/${t.name}: ${count}`);
}
console.log(`\n  5 most common traits:`);
for (const [id, count] of byCount.slice(-5)) {
  const t = traitMap.traits[id];
  console.log(`    ${t.slot}/${t.name}: ${count}`);
}
