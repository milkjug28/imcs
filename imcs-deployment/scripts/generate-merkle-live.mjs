import { SimpleMerkleTree } from "@openzeppelin/merkle-tree";
import { writeFileSync, readFileSync } from "fs";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// Load env from imcs-app
const envContent = readFileSync(new URL("../../imcs-app/.env.local", import.meta.url), "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const eq = line.indexOf("=");
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
});

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

function buildTree(addresses, phaseConfig) {
  const leafData = addresses.map((addr) => {
    const mintParams = {
      mintPrice: 0n,
      maxTotalMintableByWallet: phaseConfig.maxPerWallet || 1,
      startTime: phaseConfig.startTime,
      endTime: phaseConfig.endTime,
      dropStageIndex: phaseConfig.dropStageIndex,
      maxTokenSupplyForStage: phaseConfig.maxTokenSupplyForStage,
      feeBps: 0,
      restrictFeeRecipients: true,
    };
    const leaf = computeLeaf(addr, mintParams);
    return { address: addr, mintParams, leaf };
  });

  const leaves = leafData.map((d) => d.leaf);
  const tree = SimpleMerkleTree.of(leaves);
  return { tree, leafData };
}

async function fetchWallets(column) {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("whitelist")
      .select("wallet_address")
      .eq(column, true)
      .range(offset, offset + limit - 1);
    if (error) { console.error("DB error:", error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...data.map((r) => r.wallet_address));
    if (data.length < limit) break;
    offset += limit;
  }
  // Checksum first, then deduplicate (DB has lowercase + checksummed dupes)
  const checksummed = all
    .filter((a) => ethers.isAddress(a))
    .map((a) => ethers.getAddress(a));
  return [...new Set(checksummed)];
}

async function main() {
  console.log("Fetching wallets from DB...\n");

  const gtdWallets = await fetchWallets("gtd");
  const communityWallets = await fetchWallets("community");
  const fcfsWallets = await fetchWallets("fcfs");

  console.log(`GTD wallets: ${gtdWallets.length}`);
  console.log(`Community wallets: ${communityWallets.length}`);
  console.log(`FCFS wallets: ${fcfsWallets.length}\n`);

  const DEV_WALLET = ethers.getAddress("0x6878144669e7E558737FEB3820410174CEef04e6");
  const END_TIME = 1778471940; // May 10, 2026 11:59 PM EDT

  const phases = {
    phase0_dev: {
      name: "Dev Mint",
      dropStageIndex: 0,
      startTime: 1778245200,    // May 8, 2026 9:00 AM EDT (2hrs before GTD)
      endTime: END_TIME,
      maxTokenSupplyForStage: 3000,
      maxPerWallet: 128,
      wallets: [DEV_WALLET],
    },
    phase1_gtd: {
      name: "GTD (Guaranteed)",
      dropStageIndex: 1,
      startTime: 1778252400,    // May 8, 2026 11:00 AM EDT
      endTime: END_TIME,
      maxTokenSupplyForStage: 3000,
      wallets: gtdWallets,
    },
    phase2_community: {
      name: "Community",
      dropStageIndex: 2,
      startTime: 1778271600,    // May 8, 2026 4:20 PM EDT
      endTime: END_TIME,
      maxTokenSupplyForStage: 3000,
      wallets: communityWallets,
    },
    phase3_fcfs: {
      name: "FCFS",
      dropStageIndex: 3,
      startTime: 1778289600,    // May 8, 2026 9:20 PM EDT
      endTime: END_TIME,
      maxTokenSupplyForStage: 3000,
      wallets: fcfsWallets,
    },
  };

  const results = {};

  for (const [phaseId, config] of Object.entries(phases)) {
    const { tree, leafData } = buildTree(config.wallets, config);
    const root = tree.root;

    console.log(`${config.name} (index ${config.dropStageIndex})`);
    console.log(`  Root: ${root}`);
    console.log(`  Wallets: ${leafData.length}`);

    const proofs = {};
    for (let i = 0; i < leafData.length; i++) {
      const data = leafData[i];
      proofs[data.address] = {
        proof: tree.getProof(i),
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

    results[phaseId] = { root, config: { name: config.name, dropStageIndex: config.dropStageIndex }, proofs };
    console.log();
  }

  const outputPath = new URL("../config/merkle-output.json", import.meta.url);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log("Merkle data written to config/merkle-output.json");

  console.log("\n=== MERKLE ROOTS FOR CONTRACT ===");
  for (const [phaseId, data] of Object.entries(results)) {
    console.log(`${data.config.name}: ${data.root}`);
  }
}

main().catch(console.error);
