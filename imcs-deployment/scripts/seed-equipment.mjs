// Seeds the SavantEquipManager + pre-mints trait supply to it.
//
// Steps (run individually for retries, or "all"):
//   supply    - setMaxSupply per trait + mintBatch all original supply to manager
//   combos    - seedComboHashes for all 4269 tokens (batched)
//   equipment - seedEquipment (10-slot arrays) for all 4269 tokens (batched)
//
// Usage:
//   node scripts/seed-equipment.mjs all
//   node scripts/seed-equipment.mjs combos
//
// Env (imcs-deployment/.env):
//   SEED_RPC_URL            Base (Sepolia or mainnet) RPC
//   PRIVATE_KEY             contract owner / deployer
//   EQUIPMENT_ADDRESS       deployed SavantEquipment
//   EQUIP_MANAGER_ADDRESS   deployed SavantEquipManager

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonRpcProvider, Wallet, Contract } from 'ethers'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')

// minimal .env loader (no dependency); does not override already-set vars
function loadEnv() {
  const envPath = join(__dirname, '..', '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    if (process.env[key] !== undefined) continue
    process.env[key] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const COMBO_BATCH = Number(process.env.COMBO_BATCH || 250)
const EQUIP_BATCH = Number(process.env.EQUIP_BATCH || 40) // ~7.4M gas; RPC estimateGas caps ~10M
const MINT_BATCH = Number(process.env.MINT_BATCH || 160)

const EQUIPMENT_ABI = [
  'function setMaxSupply(uint256 id, uint256 amount) external',
  'function mintBatch(address to, uint256[] ids, uint256[] amounts) external',
  'function totalSupply(uint256 id) view returns (uint256)',
  'function maxSupply(uint256 id) view returns (uint256)',
]
const MANAGER_ABI = [
  'function seedComboHashes(uint256[] tokenIds, bytes32[] hashes) external',
  'function seedEquipment(uint256[] tokenIds, uint256[10][] slots) external',
  'function tokenToCombo(uint256) view returns (bytes32)',
  'function equipment() view returns (address)',
]

function loadJson(name) {
  return JSON.parse(readFileSync(join(DATA, name), 'utf8'))
}

function requireEnv(key) {
  const v = process.env[key]
  if (!v) throw new Error(`${key} unset`)
  return v
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function send(label, txPromise) {
  const tx = await txPromise
  process.stdout.write(`  ${label} -> ${tx.hash} ... `)
  const rcpt = await tx.wait()
  console.log(`mined (gas ${rcpt.gasUsed})`)
  return rcpt
}

async function seedSupply(equipment, manager) {
  const { supplyCounts } = loadJson('trait-supply.json')
  const ids = Object.keys(supplyCounts).map(Number).sort((a, b) => a - b)
  console.log(`supply: ${ids.length} trait ids, total ${ids.reduce((s, id) => s + supplyCounts[id], 0)} tokens`)

  const managerAddr = await manager.getAddress()

  // 1. set max supply = original count (locks originals; card-pack traits use new ids).
  // SKIP_MAX_SUPPLY=1 for testnet: maxSupply 0 = unlimited, mint still works, saves ~160 txs.
  if (process.env.SKIP_MAX_SUPPLY === '1') {
    console.log('  SKIP_MAX_SUPPLY=1, leaving supply uncapped')
  } else {
    for (const id of ids) {
      const existing = await equipment.maxSupply(id)
      if (existing > 0n) continue
      await send(`setMaxSupply(${id}, ${supplyCounts[id]})`, equipment.setMaxSupply(id, supplyCounts[id]))
    }
  }

  // 2. pre-mint to manager (skip ids already minted for idempotency)
  const toMint = []
  for (const id of ids) {
    const minted = await equipment.totalSupply(id)
    if (minted >= BigInt(supplyCounts[id])) continue
    toMint.push(id)
  }
  if (toMint.length === 0) {
    console.log('  all supply already minted, skipping mint')
    return
  }
  for (const batch of chunk(toMint, MINT_BATCH)) {
    const amounts = batch.map(id => supplyCounts[id])
    await send(`mintBatch(${batch.length} ids)`, equipment.mintBatch(managerAddr, batch, amounts))
  }
}

async function seedCombos(manager) {
  const { comboHashes } = loadJson('combo-hashes.json')
  const tokenIds = Object.keys(comboHashes).map(Number).sort((a, b) => a - b)
  console.log(`combos: ${tokenIds.length} tokens`)

  for (const batch of chunk(tokenIds, COMBO_BATCH)) {
    // idempotency: skip batch if first+last already seeded with matching hash
    const first = await manager.tokenToCombo(batch[0])
    const last = await manager.tokenToCombo(batch[batch.length - 1])
    if (first.toLowerCase() === comboHashes[batch[0]].toLowerCase() &&
        last.toLowerCase() === comboHashes[batch[batch.length - 1]].toLowerCase()) {
      console.log(`  skip combos ${batch[0]}-${batch[batch.length - 1]} (seeded)`)
      continue
    }
    const hashes = batch.map(id => comboHashes[id])
    await send(`seedComboHashes ${batch[0]}-${batch[batch.length - 1]}`, manager.seedComboHashes(batch, hashes))
  }
}

async function seedEquipment(manager) {
  const tokenTraits = loadJson('token-traits.json')
  const tokenIds = Object.keys(tokenTraits).map(Number).sort((a, b) => a - b)
  console.log(`equipment: ${tokenIds.length} tokens`)

  for (const batch of chunk(tokenIds, EQUIP_BATCH)) {
    const slots = batch.map(id => {
      const s = tokenTraits[id]
      if (s.length !== 10) throw new Error(`token ${id} has ${s.length} slots`)
      return s
    })
    await send(`seedEquipment ${batch[0]}-${batch[batch.length - 1]}`, manager.seedEquipment(batch, slots))
  }
}

async function main() {
  const step = process.argv[2] || 'all'
  const provider = new JsonRpcProvider(requireEnv('SEED_RPC_URL'))
  const wallet = new Wallet(requireEnv('PRIVATE_KEY'), provider)
  const equipment = new Contract(requireEnv('EQUIPMENT_ADDRESS'), EQUIPMENT_ABI, wallet)
  const manager = new Contract(requireEnv('EQUIP_MANAGER_ADDRESS'), MANAGER_ABI, wallet)

  const net = await provider.getNetwork()
  console.log(`seeder ${wallet.address} on chainId ${net.chainId}, step=${step}`)
  const wired = await manager.equipment()
  if (wired.toLowerCase() !== (await equipment.getAddress()).toLowerCase()) {
    throw new Error(`manager.equipment() ${wired} != EQUIPMENT_ADDRESS`)
  }

  if (step === 'supply' || step === 'all') await seedSupply(equipment, manager)
  if (step === 'combos' || step === 'all') await seedCombos(manager)
  if (step === 'equipment' || step === 'all') await seedEquipment(manager)

  console.log('done. remember: manager.setClaimsEnabled(true) after verifying.')
}

main().catch(e => { console.error(e); process.exit(1) })
