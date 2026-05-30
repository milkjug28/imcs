// READ-ONLY analysis. Builds the full combined airdrop (everyone >=1 pack),
// labels each wallet by tier group, runs an on-chain contract check (ETH
// mainnet, where savants live), prints summary + writes a CSV for review.
// Writes ONLY the report CSV. Does not touch the airdrop list.
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

async function getCode(rpc: string, addr: string): Promise<string> {
  const res = await fetch(rpc, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [addr, 'latest'] }),
  })
  const j = await res.json()
  return j.result || '0x'
}

for (const file of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), 'utf-8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const ZERO = '0x0000000000000000000000000000000000000000'
const DEV = '0x6878144669e7e558737feb3820410174ceef04e6'
const ONE_OF_ONE = new Set([315, 851, 1023, 1865, 2902, 3541, 4248])
const baseIQ = (id: number) => (ONE_OF_ONE.has(id) ? 111 : 69)
const TIERS = [
  { iq: 1000, packs: 7 }, { iq: 740, packs: 6 }, { iq: 500, packs: 5 },
  { iq: 420, packs: 4 }, { iq: 250, packs: 3 }, { iq: 120, packs: 2 }, { iq: 80, packs: 1 },
]
const tierPacks = (iq: number) => (iq < 80 ? 0 : TIERS.find(t => iq >= t.iq)?.packs ?? 0)
const OUT = resolve(process.cwd(), '..', 'imcs-deployment', 'data', 'airdrop-breakdown.csv')

async function main() {
  const allocated = new Map<number, number>()
  let page = 0
  while (true) {
    const { data, error } = await supabase.from('savant_iq').select('token_id, iq_points').range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const r of data) allocated.set(Number(r.token_id), Number(r.iq_points) || 0)
    if (data.length < 1000) break
    page++
  }

  const pgPool = new pg.Pool({ connectionString: process.env.RENDER_POSTGRES_URL!, ssl: { rejectUnauthorized: false } })
  const { rows } = await pgPool.query(`
    SELECT DISTINCT ON (token_id) token_id::int AS token_id, "to" AS owner
    FROM imcs_transfers ORDER BY token_id, block_number DESC, vid DESC`)
  await pgPool.end()

  const hold = new Map<string, number[]>()
  const hold1of1 = new Map<string, number>()
  for (const row of rows) {
    const owner = row.owner.toLowerCase()
    if (owner === ZERO || owner === DEV) continue
    const iq = baseIQ(row.token_id) + (allocated.get(row.token_id) || 0)
    if (!hold.has(owner)) { hold.set(owner, []); hold1of1.set(owner, 0) }
    hold.get(owner)!.push(iq)
    if (ONE_OF_ONE.has(row.token_id)) hold1of1.set(owner, hold1of1.get(owner)! + 1)
  }

  type Row = { wallet: string; savants: number; sumIQ: number; packs: number; tier: string; is1of1: boolean }
  const out: Row[] = []
  for (const [wallet, iqs] of hold) {
    const savants = iqs.length
    const sumIQ = iqs.reduce((s, i) => s + i, 0)
    const allJust69 = iqs.every(i => i === 69)
    const is1of1 = hold1of1.get(wallet)! > 0
    let p = tierPacks(sumIQ)
    let tier: string
    if (p > 1 && allJust69) { p = 1; tier = 'CAPPED (multi-savant, no IQ activity)' }
    else if (p >= 1) tier = is1of1 ? 'TIERED (1/1 holder)' : 'TIERED (IQ participant)'
    else { p = 1; tier = 'FLAT-1 (single savant, sub-80)' } // everyone-included floor
    out.push({ wallet, savants, sumIQ, packs: p, tier, is1of1 })
  }
  out.sort((a, b) => b.packs - a.packs || b.sumIQ - a.sumIQ)

  // tier summary
  const byTier = new Map<string, { wallets: number; packs: number; savants: number }>()
  for (const r of out) {
    const t = byTier.get(r.tier) || { wallets: 0, packs: 0, savants: 0 }
    t.wallets++; t.packs += r.packs; t.savants += r.savants
    byTier.set(r.tier, t)
  }
  console.log(`\nTOTAL: ${out.length} holders, ${out.reduce((s, r) => s + r.packs, 0)} packs\n`)
  console.log('TIER GROUPS:')
  for (const [tier, t] of byTier) {
    console.log(`  ${tier.padEnd(42)} wallets=${String(t.wallets).padStart(4)}  packs=${String(t.packs).padStart(4)}  savants=${String(t.savants).padStart(4)}`)
  }

  // pack-count distribution
  const dist = new Map<number, number>()
  for (const r of out) dist.set(r.packs, (dist.get(r.packs) || 0) + 1)
  console.log('\nPACKS PER WALLET:')
  for (const p of [...dist.keys()].sort((a, b) => a - b)) console.log(`  ${p} packs : ${dist.get(p)} wallets`)

  // on-chain contract check (ETH mainnet, where savant ERC721 lives)
  const rpc = process.env.RPC_URL_MAINNET || process.env.NEXT_PUBLIC_RPC_URL_MAINNET
  const contracts: string[] = []
  if (rpc) {
    console.log(`\ncontract-check ${out.length} wallets on ETH mainnet...`)
    let i = 0
    for (const r of out) {
      try { const code = await getCode(rpc, r.wallet); if (code && code !== '0x') contracts.push(r.wallet) } catch {}
      if (++i % 200 === 0) process.stdout.write(`  ${i}/${out.length}\n`)
      await new Promise(res => setTimeout(res, 25))
    }
    console.log(`contracts (code at address): ${contracts.length}`)
    for (const c of contracts) { const r = out.find(x => x.wallet === c)!; console.log(`  ${c}  ${r.savants} savants  ${r.packs} packs  [${r.tier}]`) }
  } else {
    console.log('\n(no RPC_URL_MAINNET; skipped contract check)')
  }

  const csv = ['wallet,savants,sumIQ,packs,tier,is1of1,isContract',
    ...out.map(r => `${r.wallet},${r.savants},${r.sumIQ},${r.packs},"${r.tier}",${r.is1of1},${contracts.includes(r.wallet)}`)].join('\n')
  writeFileSync(OUT, csv)
  console.log(`\nwrote full per-wallet list -> ${OUT}`)
}
main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1) })
