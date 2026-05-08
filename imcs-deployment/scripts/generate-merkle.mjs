import { SimpleMerkleTree } from "@openzeppelin/merkle-tree";
import { readFileSync, writeFileSync } from "fs";
import { ethers } from "ethers";

const CSV_PATH = process.env.CSV_PATH || "../testmint-whitelist.csv";

function parseCSV(path) {
  const raw = readFileSync(new URL(path, import.meta.url), "utf-8");
  const lines = raw.trim().split("\n").slice(1);
  return lines
    .map((l) => l.split(",").map((s) => s.trim()))
    .filter((cols) => cols[0] && ethers.isAddress(cols[0]))
    .map(([addr, limit, price]) => ({
      address: ethers.getAddress(addr),
      mintLimit: parseInt(limit) || 1,
      price: price || "0",
    }));
}

// Match SeaDrop's leaf: keccak256(abi.encode(address, MintParams))
// MintParams = (uint256 mintPrice, uint256 maxTotalMintableByWallet, uint256 startTime,
//               uint256 endTime, uint256 dropStageIndex, uint256 maxTokenSupplyForStage,
//               uint256 feeBps, bool restrictFeeRecipients)
function computeLeaf(address, mintParams) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    ["address", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "bool"],
    [
      address,
      mintParams.mintPrice,
      mintParams.maxTotalMintableByWallet,
      mintParams.startTime,
      mintParams.endTime,
      mintParams.dropStageIndex,
      mintParams.maxTokenSupplyForStage,
      mintParams.feeBps,
      mintParams.restrictFeeRecipients,
    ]
  );
  return ethers.keccak256(encoded);
}

function buildTree(entries, phaseConfig) {
  const leafData = entries.map((e) => {
    const mintParams = {
      mintPrice: ethers.parseEther(e.price || "0"),
      maxTotalMintableByWallet: e.mintLimit || phaseConfig.maxPerWallet,
      startTime: phaseConfig.startTime,
      endTime: phaseConfig.endTime,
      dropStageIndex: phaseConfig.dropStageIndex,
      maxTokenSupplyForStage: phaseConfig.maxTokenSupplyForStage,
      feeBps: phaseConfig.feeBps,
      restrictFeeRecipients: phaseConfig.restrictFeeRecipients,
    };
    const leaf = computeLeaf(e.address, mintParams);
    return { address: e.address, mintParams, leaf };
  });

  const leaves = leafData.map((d) => d.leaf);
  const tree = SimpleMerkleTree.of(leaves);

  return { tree, leafData };
}

const now = Math.floor(Date.now() / 1000);
const thirtyDays = 30 * 24 * 60 * 60;

const phases = {
  phase1_gtd: {
    name: "GTD (Guaranteed)",
    dropStageIndex: 1,
    maxPerWallet: 1,
    startTime: now,
    endTime: now + thirtyDays,
    maxTokenSupplyForStage: 3000,
    feeBps: 0,
    restrictFeeRecipients: true,
  },
  phase2_community: {
    name: "Community",
    dropStageIndex: 2,
    maxPerWallet: 1,
    startTime: now,
    endTime: now + thirtyDays,
    maxTokenSupplyForStage: 3000,
    feeBps: 0,
    restrictFeeRecipients: true,
  },
  phase3_fcfs: {
    name: "FCFS",
    dropStageIndex: 3,
    maxPerWallet: 1,
    startTime: now,
    endTime: now + thirtyDays,
    maxTokenSupplyForStage: 3000,
    feeBps: 0,
    restrictFeeRecipients: true,
  },
};

const entries = parseCSV(CSV_PATH);
console.log(`Loaded ${entries.length} addresses from CSV\n`);

const results = {};

for (const [phaseId, config] of Object.entries(phases)) {
  const { tree, leafData } = buildTree(entries, config);
  const root = tree.root;

  console.log(`${config.name} (index ${config.dropStageIndex})`);
  console.log(`  Root: ${root}`);
  console.log(`  Leaves: ${leafData.length}`);

  const proofs = {};
  for (const data of leafData) {
    const leafIndex = leafData.indexOf(data);
    proofs[data.address] = {
      proof: tree.getProof(leafIndex),
      mintParams: {
        mintPrice: data.mintParams.mintPrice.toString(),
        maxTotalMintableByWallet: data.mintParams.maxTotalMintableByWallet.toString(),
        startTime: data.mintParams.startTime.toString(),
        endTime: data.mintParams.endTime.toString(),
        dropStageIndex: data.mintParams.dropStageIndex.toString(),
        maxTokenSupplyForStage: data.mintParams.maxTokenSupplyForStage.toString(),
        feeBps: data.mintParams.feeBps.toString(),
        restrictFeeRecipients: data.mintParams.restrictFeeRecipients,
      },
    };
  }

  results[phaseId] = { root, config, proofs };
  console.log();
}

const outputPath = new URL("../config/merkle-output.json", import.meta.url);
writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`Merkle data written to config/merkle-output.json`);

console.log("\n=== MERKLE ROOTS FOR CONTRACT ===");
for (const [phaseId, data] of Object.entries(results)) {
  console.log(`${data.config.name}: ${data.root}`);
}
