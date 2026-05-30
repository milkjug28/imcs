// Seeds the SavantPack trait pool for a card-pack season.
//
// Pack traits are mint-on-rip: the pack mints each trait to the ripper when a
// slot hits. Two limiters work together:
//   1. pool counter on the pack -- decrements each rip, season closes at 0.
//   2. maxSupply cap on equipment -- hard ceiling so a trait can never exceed
//      its intended supply, even if the pool is re-seeded.
//
// maxSupply for each trait = what already exists + what the pool can mint:
//   - mainnet (fresh equipment, totalSupply 0): cap = poolAmount
//   - testnet (junk pre-mints from equip tests): cap = preMint + poolAmount,
//     leaving exactly poolAmount rips of headroom.
//
// Usage:
//   node scripts/seed-pack-pool.mjs            # setMaxSupply + seedPool
//   node scripts/seed-pack-pool.mjs --dry      # print plan, send nothing
//
// Env (imcs-deployment/.env):
//   SEED_RPC_URL        Base RPC (falls back to RPC_URL_BASE_SEPOLIA)
//   SIGNER_PRIVATE_KEY  equipment owner + pack owner (the signer wallet)
//   EQUIPMENT_ADDRESS   deployed SavantEquipment
//   PACK_ADDRESS        deployed SavantPack

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonRpcProvider, Wallet, Contract } from 'ethers'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')
const DRY = process.argv.includes('--dry')

function loadEnv() {
  const envPath = join(__dirname, '..', '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    if (process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

function requireEnv(key) {
  const v = process.env[key]
  if (!v) throw new Error(`${key} unset`)
  return v
}

const EQUIPMENT_ABI = [
  'function setMaxSupply(uint256 id, uint256 amount) external',
  'function totalSupply(uint256 id) view returns (uint256)',
  'function maxSupply(uint256 id) view returns (uint256)',
  'function authorizedMinters(address) view returns (bool)',
]
const PACK_ABI = [
  'function seedPool(uint256[] tokenIds, uint256[] amounts) external',
  'function totalRemaining() view returns (uint256)',
  'function poolSize() view returns (uint256)',
]

// txFn is a thunk so the transaction is only built (and broadcast) when NOT dry.
async function send(label, txFn) {
  if (DRY) { console.log(`  [dry] ${label}`); return }
  const tx = await txFn()
  process.stdout.write(`  ${label} -> ${tx.hash} ... `)
  const rcpt = await tx.wait()
  console.log(`mined (gas ${rcpt.gasUsed})`)
  return rcpt
}

async function main() {
  const { mintBatch, totalNewInstances } = JSON.parse(
    readFileSync(join(DATA, 'new-trait-supply.json'), 'utf8')
  )
  const ids = mintBatch.traitIds
  const amounts = mintBatch.amounts
  if (ids.length !== amounts.length) throw new Error('traitIds/amounts length mismatch')
  console.log(`pool: ${ids.length} trait ids, ${totalNewInstances} instances`)

  const rpc = process.env.SEED_RPC_URL || process.env.RPC_URL_BASE_SEPOLIA
  if (!rpc) throw new Error('SEED_RPC_URL or RPC_URL_BASE_SEPOLIA unset')
  const provider = new JsonRpcProvider(rpc)
  const wallet = new Wallet(requireEnv('SIGNER_PRIVATE_KEY'), provider)
  const equipment = new Contract(requireEnv('EQUIPMENT_ADDRESS'), EQUIPMENT_ABI, wallet)
  const packAddr = requireEnv('PACK_ADDRESS')
  const pack = new Contract(packAddr, PACK_ABI, wallet)

  // 0. pack must be an authorized minter on equipment, else mint-on-rip reverts.
  const isMinter = await equipment.authorizedMinters(packAddr)
  if (!isMinter) {
    throw new Error(
      `pack ${packAddr} is NOT an authorized minter on equipment. ` +
      `Run equipment.setMinter(pack, true) first (DeployPack does this).`
    )
  }
  console.log(`pack authorized as minter: ok`)

  // 1. set each trait's hard ceiling = current supply + pool amount
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const want = amounts[i]
    const [supply, cap] = await Promise.all([
      equipment.totalSupply(id),
      equipment.maxSupply(id),
    ])
    const target = supply + BigInt(want)
    if (cap === target) {
      console.log(`  setMaxSupply(${id}) skip (already ${target})`)
      continue
    }
    console.log(`  id ${id}: supply ${supply} + pool ${want} -> maxSupply ${target}`)
    await send(`setMaxSupply(${id}, ${target})`, () => equipment.setMaxSupply(id, target))
  }

  // 2. load pool counters on the pack (replaces any prior pool)
  console.log(`seedPool(${ids.length} ids)`)
  await send(`seedPool`, () => pack.seedPool(ids, amounts))

  if (!DRY) {
    const [remaining, size] = await Promise.all([pack.totalRemaining(), pack.poolSize()])
    console.log(`\npool now: ${remaining} instances across ${size} trait ids`)
    if (remaining !== BigInt(totalNewInstances)) {
      console.warn(`WARN: totalRemaining ${remaining} != expected ${totalNewInstances}`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
