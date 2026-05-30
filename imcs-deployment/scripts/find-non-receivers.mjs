// Finds airdrop recipients that revert an ERC1155 mint (non-receiver), drops
// them from pack-airdrop.json, writes the dropped list, and reports.
// Only tests code-bearing addresses; plain EOAs always accept.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JsonRpcProvider, Wallet, Contract, getAddress } from 'ethers'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')
function loadEnv() {
  const p = join(__dirname, '..', '.env')
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const PACK_ABI = ['function airdropPacks(address[] to, uint256[] amounts) external']
const provider = new JsonRpcProvider(process.env.SEED_RPC_URL || process.env.RPC_URL_BASE)
const wallet = new Wallet(process.env.PRIVATE_KEY, provider)
const pack = new Contract(process.env.PACK_ADDRESS, PACK_ABI, wallet)

const file = JSON.parse(readFileSync(join(DATA, 'pack-airdrop.json'), 'utf8'))
const recipients = file.recipients.map(r => ({ ...r, wallet: getAddress(r.wallet ?? r.address), amount: Number(r.packs ?? r.amount) }))

// only addresses with code can fail the receiver check
const withCode = []
for (const r of recipients) {
  const code = await provider.getCode(r.wallet)
  if (code && code !== '0x') withCode.push(r)
}
console.log(`${recipients.length} recipients, ${withCode.length} have code -> testing those`)

const bad = []
for (const r of withCode) {
  try { await pack.airdropPacks.staticCall([r.wallet], [BigInt(r.amount)]) }
  catch { bad.push(r.wallet) }
}
console.log(`non-receiver (mint reverts): ${bad.length}`)
for (const b of bad) { const r = recipients.find(x => x.wallet === b); console.log(`  ${b}  ${r.packs}pk  [${r.tier}]  ${r.savantCount} savants`) }

if (bad.length) {
  const badSet = new Set(bad.map(a => a.toLowerCase()))
  const kept = file.recipients.filter(r => !badSet.has((r.wallet ?? r.address).toLowerCase()))
  const BATCH = 100
  const batches = []
  for (let i = 0; i < kept.length; i += BATCH) {
    const s = kept.slice(i, i + BATCH)
    batches.push({ to: s.map(r => getAddress(r.wallet ?? r.address)), amounts: s.map(r => Number(r.packs ?? r.amount)) })
  }
  const out = { ...file, droppedNonReceivers: bad, totalWallets: kept.length, totalPacks: kept.reduce((s, r) => s + Number(r.packs ?? r.amount), 0), recipients: kept, batches }
  writeFileSync(join(DATA, 'pack-airdrop.json'), JSON.stringify(out, null, 2))
  writeFileSync(join(DATA, 'pack-airdrop-dropped.json'), JSON.stringify(bad, null, 2))
  console.log(`\nrewrote pack-airdrop.json: ${out.totalWallets} wallets, ${out.totalPacks} packs`)
  console.log(`dropped list -> data/pack-airdrop-dropped.json`)
} else {
  console.log('no bad recipients; list unchanged')
}
