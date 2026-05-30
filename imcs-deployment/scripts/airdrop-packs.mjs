// Airdrops sealed pack tokens to eligible holders via SavantPack.airdropPacks.
// Owner-mint (bypasses buyPack MAX_MINT_PER_WALLET). Idempotent-ish: re-running
// re-mints, so run ONCE. Use --dry to preview.
//
// Env (imcs-deployment/.env):
//   SEED_RPC_URL  / RPC_URL_BASE   Base RPC
//   PRIVATE_KEY                    pack owner (dev wallet 0x6878)
//   PACK_ADDRESS                   deployed SavantPack
//
// Data: data/pack-airdrop.json  -> [{ wallet, packs }, ...]

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonRpcProvider, Wallet, Contract, getAddress } from 'ethers'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')
const DRY = process.argv.includes('--dry')
const BATCH = 100

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

const PACK_ABI = [
  'function airdropPacks(address[] to, uint256[] amounts) external',
  'function packTokenId() view returns (uint256)',
  'function owner() view returns (address)',
]

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }

const file = JSON.parse(readFileSync(join(DATA, 'pack-airdrop.json'), 'utf8'))
const rows = file.recipients
const recipients = rows.map(r => {
  const wallet = getAddress(r.wallet ?? r.address)
  const amount = Number(r.packs ?? r.amount ?? r.count)
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`bad amount for ${wallet}: ${amount}`)
  return { wallet, amount }
})

// dedupe guard: a duplicate wallet would double-mint
const seen = new Set()
for (const r of recipients) {
  if (seen.has(r.wallet)) throw new Error(`duplicate wallet in airdrop list: ${r.wallet}`)
  seen.add(r.wallet)
}

const totalWallets = recipients.length
const totalPacks = recipients.reduce((s, r) => s + r.amount, 0)
console.log(`airdrop: ${totalWallets} wallets, ${totalPacks} packs, ${chunk(recipients, BATCH).length} batches of ${BATCH}`)

const provider = new JsonRpcProvider(process.env.SEED_RPC_URL || requireEnv('RPC_URL_BASE'))
const wallet = new Wallet(requireEnv('PRIVATE_KEY'), provider)
const pack = new Contract(requireEnv('PACK_ADDRESS'), PACK_ABI, wallet)

const net = await provider.getNetwork()
const owner = await pack.owner()
console.log(`sender ${wallet.address} on chainId ${net.chainId}, pack owner ${owner}`)
if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
  throw new Error(`sender is not pack owner; airdropPacks is onlyOwner`)
}

// pre-flight: simulate every batch via staticCall before broadcasting anything.
// catches any recipient that would revert the mint (e.g. ERC1155 receiver) for
// free, so we never spend gas on a batch that can't land.
const allBatches = chunk(recipients, BATCH)
console.log(`simulating ${allBatches.length} batches before send...`)
for (let i = 0; i < allBatches.length; i++) {
  const b = allBatches[i]
  try {
    await pack.airdropPacks.staticCall(b.map(r => r.wallet), b.map(r => BigInt(r.amount)))
    process.stdout.write(`  sim batch ${i + 1} ok\n`)
  } catch (e) {
    console.error(`  sim batch ${i + 1} REVERTS: ${e.shortMessage || e.message}`)
    throw new Error(`batch ${i + 1} would revert; aborting before any send`)
  }
}
console.log('all batches simulate clean.')

let batchNo = 0
for (const batch of allBatches) {
  batchNo++
  const tos = batch.map(r => r.wallet)
  const amts = batch.map(r => BigInt(r.amount))
  const label = `batch ${batchNo} (${batch.length} wallets, ${batch.reduce((s, r) => s + r.amount, 0)} packs)`
  if (DRY) { console.log(`  [dry] airdropPacks ${label}`); continue }
  const tx = await pack.airdropPacks(tos, amts)
  process.stdout.write(`  airdropPacks ${label} -> ${tx.hash} ... `)
  const r = await tx.wait()
  console.log(`mined (gas ${r.gasUsed})`)
}
console.log(DRY ? 'dry run complete (nothing sent)' : 'airdrop complete.')
