import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const file of ['.env', '.env.local']) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {}
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const renderPgUrl = process.env.RENDER_POSTGRES_URL!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const DEV_WALLET = '0x6878144669e7e558737feb3820410174ceef04e6'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DIAMOND_HANDS_BONUS = 5

const HOLD_TIERS = [
  { min: 51, max: Infinity, iqPerWeek: 50 },
  { min: 25, max: 50, iqPerWeek: 25 },
  { min: 6, max: 24, iqPerWeek: 10 },
  { min: 1, max: 5, iqPerWeek: 5 },
]

function getHoldReward(tokensHeld: number, days: number): number {
  for (const tier of HOLD_TIERS) {
    if (tokensHeld >= tier.min && tokensHeld <= tier.max) {
      return Math.floor(tier.iqPerWeek * days / 7)
    }
  }
  return 0
}

function getTierName(tokensHeld: number): string {
  if (tokensHeld >= 51) return 'absulut ched'
  if (tokensHeld >= 25) return 'ched savant'
  if (tokensHeld >= 6) return 'supa savants'
  if (tokensHeld >= 1) return 'reel sabant'
  return 'none'
}

interface SnapshotWallet {
  wallet: string
  leaderboard_iq: number
  trading_iq: number
  bonus_iq: number
  total_iq_points: number
  tokens_held: number
}

async function run() {
  console.log('=== DELTA IQ SNAPSHOT ===\n')

  // 1. Find most recent snapshot
  console.log('Finding previous snapshot...')
  const { data: snapshots, error: snapErr } = await supabase
    .from('iq_snapshots')
    .select('id, label, taken_at, total_holders')
    .order('taken_at', { ascending: false })
    .limit(1)

  if (snapErr || !snapshots?.length) {
    console.error('No previous snapshot found:', snapErr)
    return
  }

  const prevSnapshot = snapshots[0]
  const prevDate = new Date(prevSnapshot.taken_at)
  const now = new Date()
  const actualDays = (now.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
  const daysOverride = process.argv.find(a => a.startsWith('--days='))
  const daysSince = daysOverride ? Number(daysOverride.split('=')[1]) : actualDays

  console.log(`  Previous: "${prevSnapshot.label}" taken ${prevDate.toISOString().split('T')[0]}`)
  console.log(`  Actual days: ${actualDays.toFixed(1)}${daysOverride ? `, overridden to ${daysSince}` : ''}`)
  console.log(`  Previous holders: ${prevSnapshot.total_holders}`)

  // Find the FIRST (original) snapshot — diamond hands = held since day 1
  const { data: firstSnaps, error: firstErr } = await supabase
    .from('iq_snapshots')
    .select('id, label, taken_at')
    .order('taken_at', { ascending: true })
    .limit(1)

  if (firstErr || !firstSnaps?.length) {
    console.error('No first snapshot found:', firstErr)
    return
  }
  const firstSnapshot = firstSnaps[0]
  const isChained = firstSnapshot.id !== prevSnapshot.id
  console.log(`  First (day-1): "${firstSnapshot.label}" taken ${new Date(firstSnapshot.taken_at).toISOString().split('T')[0]}`)

  // 2. Load snapshot 1 wallet data
  console.log('\nLoading previous snapshot wallet data...')
  const prevWallets = new Map<string, SnapshotWallet>()
  let page = 0
  const pageSize = 1000
  while (true) {
    const { data } = await supabase
      .from('wallet_iq_snapshots')
      .select('wallet, leaderboard_iq, trading_iq, total_iq_points, tokens_held')
      .eq('snapshot_id', prevSnapshot.id)
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (!data || data.length === 0) break
    for (const row of data) {
      prevWallets.set(row.wallet, { ...row, bonus_iq: 0 })
    }
    if (data.length < pageSize) break
    page++
  }
  console.log(`  ${prevWallets.size} wallets in previous snapshot`)

  // Load the first snapshot's holder set (wallets present on day 1 with tokens)
  const firstSnapshotHolders = new Set<string>()
  if (isChained) {
    let fp = 0
    while (true) {
      const { data } = await supabase
        .from('wallet_iq_snapshots')
        .select('wallet, tokens_held')
        .eq('snapshot_id', firstSnapshot.id)
        .range(fp * pageSize, (fp + 1) * pageSize - 1)
      if (!data || data.length === 0) break
      for (const row of data) {
        if (row.tokens_held > 0) firstSnapshotHolders.add(row.wallet)
      }
      if (data.length < pageSize) break
      fp++
    }
  } else {
    // Only one prior snapshot exists; it IS the first snapshot
    for (const [wallet, w] of prevWallets) {
      if (w.tokens_held > 0) firstSnapshotHolders.add(wallet)
    }
  }
  console.log(`  ${firstSnapshotHolders.size} wallets held in the first snapshot`)

  // 3. Get current holdings from Goldsky
  console.log('\nFetching current holdings from Goldsky...')
  const pool = new pg.Pool({ connectionString: renderPgUrl, ssl: { rejectUnauthorized: false } })

  const { rows: ownerRows } = await pool.query(`
    SELECT "to" as wallet, COUNT(DISTINCT token_id) as token_count
    FROM (
      SELECT DISTINCT ON (token_id) token_id, "to"
      FROM imcs_transfers
      ORDER BY token_id, block_number DESC, vid DESC
    ) current_owners
    WHERE "to" != $1
    GROUP BY "to"
  `, [ZERO_ADDRESS])

  const currentHoldings = new Map<string, number>()
  let totalTokensHeld = 0
  for (const row of ownerRows) {
    const wallet = row.wallet.toLowerCase()
    if (wallet === DEV_WALLET) continue
    currentHoldings.set(wallet, Number(row.token_count))
    totalTokensHeld += Number(row.token_count)
  }
  console.log(`  ${currentHoldings.size} current holders with ${totalTokensHeld} tokens`)

  await pool.end()

  // 4. Calculate hold rewards + diamond hands
  console.log('\nCalculating rewards...')

  interface DeltaResult {
    wallet: string
    tokensHeld: number
    tier: string
    holdReward: number
    diamondHands: boolean
    diamondHandsBonus: number
    totalBonus: number
    prevLeaderboardIQ: number
    prevBonusIQ: number
    newTotalEarned: number
    isNewHolder: boolean
  }

  const results: DeltaResult[] = []
  let totalHoldReward = 0
  let totalDiamondBonus = 0
  let diamondHandsCount = 0
  let newHolderCount = 0

  for (const [wallet, tokensHeld] of currentHoldings) {
    const prev = prevWallets.get(wallet)
    const holdReward = getHoldReward(tokensHeld, daysSince)
    const isDiamondHands = firstSnapshotHolders.has(wallet)
    const diamondBonus = isDiamondHands ? DIAMOND_HANDS_BONUS : 0
    const totalBonus = holdReward + diamondBonus
    const isNewHolder = prev === undefined

    const prevLeaderboardIQ = prev?.leaderboard_iq ?? 0
    const prevBonusIQ = prev?.bonus_iq ?? 0

    if (isDiamondHands) diamondHandsCount++
    if (isNewHolder) newHolderCount++
    totalHoldReward += holdReward
    totalDiamondBonus += diamondBonus

    results.push({
      wallet,
      tokensHeld,
      tier: getTierName(tokensHeld),
      holdReward,
      diamondHands: isDiamondHands,
      diamondHandsBonus: diamondBonus,
      totalBonus,
      prevLeaderboardIQ,
      prevBonusIQ,
      newTotalEarned: prevLeaderboardIQ + prevBonusIQ + totalBonus,
      isNewHolder,
    })
  }

  results.sort((a, b) => b.newTotalEarned - a.newTotalEarned)

  // 5. Print results
  console.log(`\n${'='.repeat(130)}`)
  console.log(`DELTA SNAPSHOT: ${daysSince.toFixed(1)} days since "${prevSnapshot.label}"`)
  console.log(`${'='.repeat(130)}`)
  console.log(`  Current holders:    ${currentHoldings.size}`)
  console.log(`  Diamond hands:      ${diamondHandsCount} (held since first snapshot, day 1)`)
  console.log(`  New holders:        ${newHolderCount} (not in previous snapshot)`)
  console.log(`  Total hold reward:  ${totalHoldReward} IQ`)
  console.log(`  Total diamond bonus:${totalDiamondBonus} IQ`)
  console.log(`  Total new IQ:       ${totalHoldReward + totalDiamondBonus} IQ`)

  console.log(`\n${'='.repeat(130)}`)
  console.log(
    `${'#'.padStart(4)} | ${'TOTAL'.padStart(7)} | ${'LB IQ'.padStart(6)} | ${'BONUS'.padStart(6)} | ` +
    `${'HOLD+'.padStart(6)} | ${'DH+'.padStart(4)} | ${'TKNS'.padStart(4)} | ${'TIER'.padEnd(14)} | FLAGS`
  )
  console.log('-'.repeat(130))

  for (let i = 0; i < Math.min(50, results.length); i++) {
    const r = results[i]
    const flags = [
      r.diamondHands ? 'DIAMOND' : '',
      r.isNewHolder ? 'NEW' : '',
    ].filter(Boolean).join(' ')

    console.log(
      `${(i + 1).toString().padStart(4)} | ` +
      `${r.newTotalEarned.toString().padStart(7)} | ` +
      `${r.prevLeaderboardIQ.toString().padStart(6)} | ` +
      `${(r.prevBonusIQ + r.totalBonus).toString().padStart(6)} | ` +
      `${('+' + r.holdReward).padStart(6)} | ` +
      `${(r.diamondHandsBonus > 0 ? '+' + r.diamondHandsBonus : '').padStart(4)} | ` +
      `${r.tokensHeld.toString().padStart(4)} | ` +
      `${r.tier.padEnd(14)} | ` +
      `${flags} (${r.wallet.slice(0, 10)}...)`
    )
  }
  if (results.length > 50) console.log(`  ... and ${results.length - 50} more holders`)

  // Tier breakdown
  console.log(`\n${'='.repeat(80)}`)
  console.log('TIER BREAKDOWN')
  console.log(`${'='.repeat(80)}`)
  const tierGroups = new Map<string, { count: number; totalReward: number }>()
  for (const r of results) {
    const g = tierGroups.get(r.tier) || { count: 0, totalReward: 0 }
    g.count++
    g.totalReward += r.holdReward
    tierGroups.set(r.tier, g)
  }
  for (const [tier, g] of tierGroups) {
    console.log(`  ${tier.padEnd(14)} | ${g.count.toString().padStart(5)} holders | ${g.totalReward.toString().padStart(7)} total IQ`)
  }

  // Paper hands: in previous snapshot but no longer holding
  const leftCount = Array.from(prevWallets.keys()).filter(w => !currentHoldings.has(w)).length
  console.log(`\n  Paper hands (left since previous snapshot): ${leftCount}`)
  const ogLeftCount = Array.from(firstSnapshotHolders).filter(w => !currentHoldings.has(w)).length
  console.log(`  Day-1 wallets that paper-handed out: ${ogLeftCount}`)

  // Save
  const shouldSave = process.argv.includes('--save')
  if (!shouldSave) {
    console.log('\nDry run complete. Pass --save to write to Supabase.')
    return
  }

  const label = process.argv.find(a => a.startsWith('--label='))?.split('=')[1] || 'delta-snapshot'

  console.log('\n=== SAVING TO SUPABASE ===')

  const totalNewIQ = totalHoldReward + totalDiamondBonus

  const { data: snapshot, error: snapCreateErr } = await supabase
    .from('iq_snapshots')
    .insert({
      label,
      total_holders: currentHoldings.size,
      total_iq_distributed: totalNewIQ,
      notes: `Delta: ${daysSince.toFixed(1)} days. Hold reward: ${totalHoldReward}. Diamond hands: ${diamondHandsCount} wallets (+${totalDiamondBonus}). New holders: ${newHolderCount}.`,
    })
    .select('id')
    .single()

  if (snapCreateErr || !snapshot) {
    console.error('Failed to create snapshot:', snapCreateErr)
    return
  }
  console.log(`  Snapshot created: ${snapshot.id}`)

  // Write wallet_iq_snapshots
  const BATCH = 500
  const snapshotRows = results.map(r => ({
    snapshot_id: snapshot.id,
    wallet: r.wallet,
    leaderboard_iq: r.prevLeaderboardIQ,
    trading_iq: 0,
    bonus_iq: r.prevBonusIQ + r.totalBonus,
    listed_count: 0,
    total_iq_points: r.newTotalEarned,
    tokens_held: r.tokensHeld,
  }))

  for (let i = 0; i < snapshotRows.length; i += BATCH) {
    const batch = snapshotRows.slice(i, i + BATCH)
    const { error } = await supabase.from('wallet_iq_snapshots').insert(batch)
    if (error) {
      console.error(`  Failed batch ${i}-${i + batch.length}:`, error)
      return
    }
  }
  console.log(`  ${snapshotRows.length} wallet snapshots written`)

  // Fetch existing allocations so we don't zero them out
  const existingAllocations = new Map<string, number>()
  let allocPage = 0
  while (true) {
    const { data } = await supabase
      .from('wallet_iq_balances')
      .select('wallet, total_allocated')
      .range(allocPage * BATCH, (allocPage + 1) * BATCH - 1)
    if (!data || data.length === 0) break
    for (const row of data) existingAllocations.set(row.wallet, row.total_allocated)
    if (data.length < BATCH) break
    allocPage++
  }

  // Compute total_earned from snapshot 1 base + new bonus (not from current balance)
  // This makes re-runs idempotent. Balance route self-heals trading IQ on next access.
  const balanceRows = results.map(r => {
    const prev = prevWallets.get(r.wallet)
    const baseTotalFromSnapshot1 = prev?.total_iq_points ?? 0
    return {
      wallet: r.wallet,
      total_earned: baseTotalFromSnapshot1 + r.totalBonus,
      total_allocated: existingAllocations.get(r.wallet) ?? 0,
      last_snapshot_id: snapshot.id,
      updated_at: new Date().toISOString(),
    }
  })

  for (let i = 0; i < balanceRows.length; i += BATCH) {
    const batch = balanceRows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('wallet_iq_balances')
      .upsert(batch, { onConflict: 'wallet' })
    if (error) {
      console.error(`  Failed balance batch ${i}-${i + batch.length}:`, error)
      return
    }
  }
  console.log(`  ${balanceRows.length} wallet balances upserted`)
  console.log('\nDelta snapshot saved.')
}

run().catch(console.error)
