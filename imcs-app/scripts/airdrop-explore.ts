// READ-ONLY. Recomputes full holder population + models eligibility scenarios
// to see how many more holders we could include and the pack cost of each.
// Mirrors generate-pack-airdrop.ts data load. Writes nothing.
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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
const POOL = 4388 // current trait instances backing rips
const TIERS = [
  { iq: 1000, packs: 7 }, { iq: 740, packs: 6 }, { iq: 500, packs: 5 },
  { iq: 420, packs: 4 }, { iq: 250, packs: 3 }, { iq: 120, packs: 2 }, { iq: 80, packs: 1 },
]
const packsFor = (iq: number, gate: number) => (iq < gate ? 0 : TIERS.find(t => iq >= t.iq)?.packs ?? 0)

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

  const pool = new pg.Pool({ connectionString: process.env.RENDER_POSTGRES_URL!, ssl: { rejectUnauthorized: false } })
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (token_id) token_id::int AS token_id, "to" AS owner
    FROM imcs_transfers ORDER BY token_id, block_number DESC, vid DESC`)
  await pool.end()

  const holderIQs = new Map<string, number[]>()
  for (const row of rows) {
    const owner = row.owner.toLowerCase()
    if (owner === ZERO || owner === DEV) continue
    const iq = baseIQ(row.token_id) + (allocated.get(row.token_id) || 0)
    if (!holderIQs.has(owner)) holderIQs.set(owner, [])
    holderIQs.get(owner)!.push(iq)
  }

  const holders = [...holderIQs.entries()].map(([w, iqs]) => ({
    wallet: w, count: iqs.length, sumIQ: iqs.reduce((s, i) => s + i, 0),
    maxIQ: Math.max(...iqs), allJust69: iqs.every(i => i === 69),
  }))
  console.log(`\ntotal non-dev holders: ${holders.length}`)
  console.log(`(OpenSea reports ~1202 incl. dev + any contract wallets)\n`)

  // why excluded today: below the 80 gate
  const below80 = holders.filter(h => h.sumIQ < 80)
  console.log(`holders below 80 summed IQ (excluded by gate): ${below80.length}`)
  console.log(`  of those, single-savant 69-IQ wallets: ${below80.filter(h => h.count === 1 && h.maxIQ === 69).length}`)
  console.log(`holders >=80 (clear the gate): ${holders.filter(h => h.sumIQ >= 80).length}`)
  const cappable = holders.filter(h => h.sumIQ >= 80 && h.allJust69 && (TIERS.find(t => h.sumIQ >= t.iq)?.packs ?? 0) > 1)
  console.log(`multi-69 holders capped 1 today (qualify >1, all-69): ${cappable.length}\n`)

  function scenario(name: string, fn: (h: typeof holders[0]) => number) {
    let wallets = 0, packs = 0
    for (const h of holders) { const p = fn(h); if (p > 0) { wallets++; packs += p } }
    const ok = packs <= POOL ? 'fits pool' : `OVER pool by ${packs - POOL}`
    console.log(`${name.padEnd(46)} wallets=${String(wallets).padStart(5)}  packs=${String(packs).padStart(5)}  [${ok}]`)
  }

  console.log(`=== SCENARIOS (pool backs ~${POOL} trait pulls; ~1838 ripsable packs expected) ===`)
  scenario('CURRENT: gate80, tier, all-69 capped to 1', h => { let p = packsFor(h.sumIQ, 80); if (p > 1 && h.allJust69) p = 1; return p })
  scenario('A) gate80, tier, NO all-69 cap', h => packsFor(h.sumIQ, 80))
  scenario('B) gate69, tier, all-69 capped to 1', h => { let p = packsFor(h.sumIQ, 69); if (p > 1 && h.allJust69) p = 1; return p })
  scenario('C) flat 1 pack per holder (all)', () => 1)
  scenario('D) flat 1 + tier bonus for >=120 IQ', h => Math.max(1, packsFor(h.sumIQ, 120)))
  scenario('E) gate69 + min1, all-69 capped 1', h => { let p = packsFor(h.sumIQ, 69); if (p > 1 && h.allJust69) p = 1; return Math.max(1, p) })
}
main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1) })
