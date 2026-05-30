// Mints all new-trait 1155s (per data/new-trait-supply.json) to the dev wallet
// on Base Sepolia. Sender = signer wallet (owner of SavantEquipment).
import { ethers } from 'ethers'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// load SIGNER_PRIVATE_KEY from monorepo root .env
const rootEnv = readFileSync(join(ROOT, '..', '.env'), 'utf-8')
const SIGNER_PK = rootEnv.match(/^SIGNER_PRIVATE_KEY=(.+)$/m)?.[1]?.trim()
if (!SIGNER_PK) { console.error('no SIGNER_PRIVATE_KEY in root .env'); process.exit(1) }

const RPC = 'https://sepolia.base.org'
const EQUIPMENT = '0x25f1C5A6f6191C83aA666E33007690071FD45720'
const DEV_WALLET = '0x6878144669e7E558737FEB3820410174CEef04e6'

const ABI = [
  'function mintBatch(address to, uint256[] ids, uint256[] amounts)',
  'function totalSupply(uint256 id) view returns (uint256)',
  'function owner() view returns (address)',
]

const supply = JSON.parse(readFileSync(join(ROOT, 'data', 'new-trait-supply.json'), 'utf-8'))
const { traitIds, amounts } = supply.mintBatch

const provider = new ethers.JsonRpcProvider(RPC)
const wallet = new ethers.Wallet(SIGNER_PK, provider)
const eq = new ethers.Contract(EQUIPMENT, ABI, wallet)

console.log('sender:', wallet.address)
console.log('owner: ', await eq.owner())
console.log(`minting ${traitIds.length} new trait types (${amounts.reduce((a, b) => a + b, 0)} instances) to ${DEV_WALLET}`)

// guard: skip if already minted (idempotent-ish) — check a sample id
const sample = await eq.totalSupply(traitIds[0])
console.log(`trait ${traitIds[0]} current supply:`, sample.toString())

const tx = await eq.mintBatch(DEV_WALLET, traitIds, amounts)
console.log('mintBatch tx:', tx.hash)
await tx.wait()
console.log('minted. confirming a few balances...')
for (const id of [traitIds[0], 7040, 5017, 8015]) {
  const s = await eq.totalSupply(id)
  console.log(`  trait ${id} totalSupply:`, s.toString())
}
console.log('DONE')
