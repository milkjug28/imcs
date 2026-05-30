import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { solidityPackedKeccak256 } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const tokenTraits = JSON.parse(readFileSync(join(ROOT, 'data', 'token-traits.json'), 'utf-8'));

const BATCH_SIZE = 100;
const comboHashes = {};
const batches = [];
let currentBatch = { tokenIds: [], hashes: [] };

const tokenIds = Object.keys(tokenTraits).map(Number).sort((a, b) => a - b);

for (const tokenId of tokenIds) {
  const slots = tokenTraits[tokenId];

  const hash = solidityPackedKeccak256(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
    slots
  );

  comboHashes[tokenId] = hash;
  currentBatch.tokenIds.push(tokenId);
  currentBatch.hashes.push(hash);

  if (currentBatch.tokenIds.length >= BATCH_SIZE) {
    batches.push(currentBatch);
    currentBatch = { tokenIds: [], hashes: [] };
  }
}

if (currentBatch.tokenIds.length > 0) {
  batches.push(currentBatch);
}

// Verify all hashes are unique
const hashSet = new Set(Object.values(comboHashes));
const duplicates = Object.keys(comboHashes).length - hashSet.size;

const output = {
  comboHashes,
  batches,
  stats: {
    totalTokens: tokenIds.length,
    totalBatches: batches.length,
    batchSize: BATCH_SIZE,
    uniqueHashes: hashSet.size,
    duplicateHashes: duplicates,
  },
};

writeFileSync(join(ROOT, 'data', 'combo-hashes.json'), JSON.stringify(output, null, 2));

console.log(`Combo hashes generated:`);
console.log(`  Tokens: ${tokenIds.length}`);
console.log(`  Batches: ${batches.length} (size ${BATCH_SIZE})`);
console.log(`  Unique hashes: ${hashSet.size}`);
console.log(`  Duplicates: ${duplicates}`);

if (duplicates > 0) {
  console.error('\n  WARNING: Duplicate combo hashes found! This should not happen.');
  const seen = {};
  for (const [id, hash] of Object.entries(comboHashes)) {
    if (seen[hash]) {
      console.error(`    Token ${id} and token ${seen[hash]} have same hash`);
    }
    seen[hash] = id;
  }
}

console.log(`\nSample:`);
console.log(`  Token #1: ${comboHashes[1]}`);
console.log(`  Token #42: ${comboHashes[42]}`);
