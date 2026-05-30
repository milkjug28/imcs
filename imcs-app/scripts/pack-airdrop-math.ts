import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const file of ['.env', '.env.local']) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const renderPgUrl = process.env.RENDER_POSTGRES_URL!
const ZERO = '0x0000000000000000000000000000000000000000'
const DEV = '0x6878144669e7e558737feb3820410174ceef04e6'
const ONE_OF_ONE = new Set([315, 851, 1023, 1865, 2902, 3541, 4248])
const baseIQ = (id: number) => (ONE_OF_ONE.has(id) ? 111 : 69)

// IQ -> packs/week tier
const TIERS = [
  { iq: 1000, packs: 7 },
  { iq: 740, packs: 6 },
  { iq: 500, packs: 5 },
  { iq: 420, packs: 4 },
  { iq: 250, packs: 3 },
  { iq: 120, packs: 2 },
  { iq: 80, packs: 1 },
]
const packsFor = (iq: number) => TIERS.find(t => iq >= t.iq)?.packs ?? 0

// Pool economics
const TOTAL_TRAITS = 1107
const SLOTS = 3
const TRAIT_RATE = 0.8
const TRAITS_PER_PACK = SLOTS * TRAIT_RATE // 2.4
const POOL_CAPACITY_PACKS = Math.floor(TOTAL_TRAITS / TRAITS_PER_PACK)

async function main() {
  // 1. allocated IQ per token
  const allocated = new Map<number, number>()
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('savant_iq')
      .select('token_id, iq_points')
      .range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    for (const r of data) allocated.set(Number(r.token_id), Number(r.iq_points) || 0)
    if (data.length < 1000) break
    page++
  }
  console.log(`savant_iq rows (tokens with allocation): ${allocated.size}`)

  // 2. current owner per token from Goldsky
  const pool = new pg.Pool({ connectionString: renderPgUrl, ssl: { rejectUnauthorized: false } })
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (token_id) token_id::int AS token_id, "to" AS owner
    FROM imcs_transfers
    ORDER BY token_id, block_number DESC, vid DESC
  `)
  await pool.end()

  // 3. per-token IQ = base + allocated; group by holder
  const holderSavantIQs = new Map<string, number[]>()
  let circulating = 0
  for (const row of rows) {
    const owner = row.owner.toLowerCase()
    if (owner === ZERO || owner === DEV) continue
    circulating++
    const iq = baseIQ(row.token_id) + (allocated.get(row.token_id) || 0)
    if (!holderSavantIQs.has(owner)) holderSavantIQs.set(owner, [])
    holderSavantIQs.get(owner)!.push(iq)
  }
  console.log(`circulating savants (excl dev/zero): ${circulating}`)
  console.log(`unique holders: ${holderSavantIQs.size}`)

  // Savant IQ distribution
  const allIQs = [...holderSavantIQs.values()].flat()
  console.log(`\nSAVANT IQ DISTRIBUTION (base+allocated, excl equip boost):`)
  for (const t of [...TIERS].reverse()) {
    const n = allIQs.filter(iq => iq >= t.iq).length
    console.log(`  >= ${t.iq.toString().padStart(4)} IQ : ${n.toString().padStart(5)} savants`)
  }
  const below80 = allIQs.filter(iq => iq < 80).length
  console.log(`  <  80 IQ : ${below80.toString().padStart(5)} savants (base 69, no/low allocation)`)

  // Interpretation A: per-savant (sum packs across all held savants)
  let packsA = 0
  for (const iqs of holderSavantIQs.values()) for (const iq of iqs) packsA += packsFor(iq)

  // Interpretation B: per-wallet by best savant (packs once)
  let packsB = 0
  let qualWalletsB = 0
  for (const iqs of holderSavantIQs.values()) {
    const p = packsFor(Math.max(...iqs))
    if (p > 0) qualWalletsB++
    packsB += p
  }

  const report = (label: string, packs: number) => {
    const traitPulls = packs * TRAITS_PER_PACK
    const pct = ((traitPulls / TOTAL_TRAITS) * 100).toFixed(0)
    console.log(`\n  ${label}`)
    console.log(`    total packs/week:      ${packs}`)
    console.log(`    expected trait pulls:  ${Math.round(traitPulls)} (${pct}% of ${TOTAL_TRAITS} pool)`)
    console.log(`    pool drains after:     ${(POOL_CAPACITY_PACKS / packs).toFixed(2)} weeks of airdrops`)
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`POOL: ${TOTAL_TRAITS} traits, ${TRAITS_PER_PACK} traits/pack avg -> ~${POOL_CAPACITY_PACKS} packs capacity`)
  console.log(`${'='.repeat(70)}`)
  report('Interpretation A — per-savant (sum across all held):', packsA)
  report('Interpretation B — per-wallet (best savant, once):', packsB)
  console.log(`\n  (B) qualifying wallets: ${qualWalletsB}`)
}

main().catch(console.error)
