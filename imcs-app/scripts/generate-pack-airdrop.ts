import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'

// Load env from .env and .env.local (matches pack-airdrop-math.ts loader)
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

// IQ -> pack count tier (descending)
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

const BATCH_SIZE = 100
const OUTPUT_PATH = resolve(process.cwd(), '..', 'imcs-deployment', 'data', 'pack-airdrop.json')

async function main() {
  // 1. allocated IQ per token from Supabase
  const allocated = new Map<number, number>()
  let page = 0
  while (true) {
    const { data, error } = await supabase
      .from('savant_iq')
      .select('token_id, iq_points')
      .range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(`Supabase savant_iq query failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) allocated.set(Number(r.token_id), Number(r.iq_points) || 0)
    if (data.length < 1000) break
    page++
  }
  console.log(`savant_iq rows (tokens with allocation): ${allocated.size}`)

  // 2. current owner per token from Goldsky Postgres mirror
  const pool = new pg.Pool({ connectionString: renderPgUrl, ssl: { rejectUnauthorized: false } })
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (token_id) token_id::int AS token_id, "to" AS owner
    FROM imcs_transfers
    ORDER BY token_id, block_number DESC, vid DESC
  `)
  await pool.end()

  // 3. per-token IQ = base + allocated; group savant IQs by holder
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

  // 4. grant: cumulative summed-IQ tier (cap 7) for participants. Override: a
  //    wallet whose savants are ALL "just 69" (no 1/1, zero allocated IQ = no
  //    participation) gets a flat 1 "come get interested" pack, regardless of
  //    how many they hold. This caps non-participant multi-holders at 1.
  let knockedDown = 0 // all-69 multi-holders that qualified for >1 but capped to 1
  const recipients: { wallet: string; packs: number; savantCount: number; walletIQ: number; tier: string }[] = []
  for (const [wallet, iqs] of holderSavantIQs) {
    const walletIQ = iqs.reduce((s, iq) => s + iq, 0)
    let packs = packsFor(walletIQ) // tier table, cap 7, 0 below 80
    const allJust69 = iqs.every(iq => iq === 69)
    let tier: string
    if (packs > 1 && allJust69) { knockedDown++; packs = 1; tier = 'CAPPED' }
    else if (packs >= 1) tier = 'TIERED'
    else { packs = 1; tier = 'FLAT1' } // everyone-included floor: sub-80 -> 1
    recipients.push({ wallet, packs, savantCount: iqs.length, walletIQ, tier })
  }
  // dev hold: mint a reserve to the dev wallet (excluded from holder grant above)
  const DEV_HOLD = 50
  recipients.push({ wallet: DEV, packs: DEV_HOLD, savantCount: 0, walletIQ: 0, tier: 'DEV' })
  // Deterministic ordering: highest packs first, then wallet address
  recipients.sort((a, b) => b.packs - a.packs || (a.wallet < b.wallet ? -1 : 1))

  const totalPacks = recipients.reduce((s, r) => s + r.packs, 0)

  // 5. chunk into aligned to[]/amounts[] batches of BATCH_SIZE
  const batches: { to: string[]; amounts: number[] }[] = []
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const slice = recipients.slice(i, i + BATCH_SIZE)
    batches.push({
      to: slice.map(r => r.wallet),
      amounts: slice.map(r => r.packs),
    })
  }

  const output = {
    generatedAt: new Date().toISOString(),
    grantRule: 'everyone-min1-summed-iq-tier-all69-capped-1',
    totalWallets: recipients.length,
    totalPacks,
    recipients,
    batches,
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))

  // 6. summary
  console.log(`\n${'='.repeat(60)}`)
  console.log(`GRANT RULE: everyone >=1; summed tier (cap 7); all-69 capped to 1`)
  console.log(`total wallets (all holders):    ${recipients.length}`)
  console.log(`total packs to airdrop:         ${totalPacks}`)
  console.log(`all-69 capped to 1:             ${knockedDown}`)
  console.log(`batches (size ${BATCH_SIZE}):              ${batches.length}`)
  const tc: Record<string, { w: number; p: number }> = {}
  for (const r of recipients) { tc[r.tier] = tc[r.tier] || { w: 0, p: 0 }; tc[r.tier].w++; tc[r.tier].p += r.packs }
  console.log(`\nTIERS:`)
  for (const t of Object.keys(tc)) console.log(`  ${t.padEnd(8)} wallets=${tc[t].w}  packs=${tc[t].p}`)

  const dist = new Map<number, number>()
  for (const r of recipients) dist.set(r.packs, (dist.get(r.packs) || 0) + 1)
  console.log(`\nPACK DISTRIBUTION (wallets per pack count):`)
  for (const packs of [...dist.keys()].sort((a, b) => a - b)) {
    console.log(`  ${packs.toString().padStart(3)} packs : ${dist.get(packs)!.toString().padStart(5)} wallets`)
  }

  const top = recipients[0]
  console.log(`\nLARGEST RECIPIENT:`)
  console.log(`  ${top.wallet} -> ${top.packs} packs (${top.savantCount} savants, ${top.walletIQ} summed IQ)`)
  console.log(`\nwrote ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error('FAILED:', err.message || err)
  process.exit(1)
})
