import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env and .env.local
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
const WL_THRESHOLD = 1017
const IQ_BONUS_CAP = 150
const IQ_FLOOR = 69
const IQ_CAP = 420

const MINT_HELD_BONUS = 5
const SELL_PENALTY = -10
const BUY_BONUS = 2
const LISTING_PENALTY = -1

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY!
const OPENSEA_COLLECTION_SLUG = 'imaginary-magic-crypto-savants'

interface TransferRow {
  from: string
  to: string
  token_id: string
  block_number: string
}

interface WalletIQ {
  wallet: string
  name: string
  leaderboardPoints: number
  leaderboardIQ: number
  mintedCount: number
  mintedStillHeld: number
  soldCount: number
  boughtCount: number
  listedCount: number
  tradingIQ: number
  totalIQPoints: number
  tokensHeld: number
  isHolder: boolean
}

async function getLeaderboardData(): Promise<Map<string, { points: number; name: string }>> {
  const { data: submissions } = await supabase
    .from('submissions')
    .select('wallet_address, name, score, ip_address')

  const { data: taskCompletions } = await supabase
    .from('task_completions')
    .select('wallet_address, score')

  const taskPointsMap = new Map<string, number>()
  if (taskCompletions) {
    for (const task of taskCompletions) {
      const wallet = task.wallet_address.toLowerCase()
      taskPointsMap.set(wallet, (taskPointsMap.get(wallet) || 0) + (task.score || 0))
    }
  }

  const ipToWalletMap = new Map<string, string>()
  if (submissions) {
    for (const sub of submissions) {
      if (sub.ip_address) {
        ipToWalletMap.set(sub.ip_address, sub.wallet_address.toLowerCase())
      }
    }
  }

  const { data: walletVotes } = await supabase
    .from('votes')
    .select('voter_identifier')
    .like('voter_identifier', '0x%')
  const votingKarmaMap = new Map<string, number>()
  if (walletVotes) {
    for (const vote of walletVotes) {
      const wallet = vote.voter_identifier.toLowerCase()
      votingKarmaMap.set(wallet, (votingKarmaMap.get(wallet) || 0) + 1)
    }
  }

  const { data: ipVotes } = await supabase
    .from('votes')
    .select('voter_identifier')
    .not('voter_identifier', 'like', '0x%')
  if (ipVotes) {
    for (const vote of ipVotes) {
      const wallet = ipToWalletMap.get(vote.voter_identifier)
      if (wallet) {
        votingKarmaMap.set(wallet, (votingKarmaMap.get(wallet) || 0) + 1)
      }
    }
  }

  const leaderboard = new Map<string, { points: number; name: string }>()

  if (submissions) {
    for (const sub of submissions) {
      const wallet = sub.wallet_address.toLowerCase()
      const taskPoints = taskPointsMap.get(wallet) || 0
      const votingKarma = votingKarmaMap.get(wallet) || 0
      const submissionScore = Number(sub.score) || 0
      leaderboard.set(wallet, {
        points: submissionScore + taskPoints + votingKarma,
        name: sub.name || 'Unknown',
      })
    }
  }

  const allWallets = new Set([...taskPointsMap.keys(), ...votingKarmaMap.keys()])
  for (const wallet of allWallets) {
    if (!leaderboard.has(wallet)) {
      const taskPoints = taskPointsMap.get(wallet) || 0
      const votingKarma = votingKarmaMap.get(wallet) || 0
      if (taskPoints + votingKarma > 0) {
        leaderboard.set(wallet, { points: taskPoints + votingKarma, name: 'Anonymous' })
      }
    }
  }

  return leaderboard
}

async function getTransferData(pool: pg.Pool) {
  const { rows: transfers } = await pool.query<TransferRow>(
    `SELECT "from", "to", token_id::text, block_number::text
     FROM imcs_transfers
     ORDER BY block_number ASC, vid ASC`
  )
  return transfers
}

function calculateLeaderboardIQ(points: number, maxPoints: number): number {
  if (points < WL_THRESHOLD) return 0
  const bonusIQ = Math.floor(((points - WL_THRESHOLD) / (maxPoints - WL_THRESHOLD)) * IQ_BONUS_CAP)
  return IQ_FLOOR + bonusIQ
}

async function getActiveListings(): Promise<Map<string, number>> {
  const listedPerWallet = new Map<string, number>()
  let next: string | undefined = undefined

  console.log('Fetching active listings from OpenSea...')
  let totalListings = 0

  do {
    const url = new URL(`https://api.opensea.io/api/v2/listings/collection/${OPENSEA_COLLECTION_SLUG}/all`)
    url.searchParams.set('limit', '100')
    if (next) url.searchParams.set('next', next)

    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': OPENSEA_API_KEY },
    })

    if (!res.ok) {
      console.error(`  OpenSea API error: ${res.status} ${res.statusText}`)
      break
    }

    const data = await res.json()
    const listings = data.listings || []

    for (const listing of listings) {
      const maker = listing.protocol_data?.parameters?.offerer?.toLowerCase()
      if (maker) {
        listedPerWallet.set(maker, (listedPerWallet.get(maker) || 0) + 1)
        totalListings++
      }
    }

    next = data.next || undefined
  } while (next)

  console.log(`  ${totalListings} active listings across ${listedPerWallet.size} wallets`)
  return listedPerWallet
}

async function buildSnapshot() {
  console.log('=== IQ SNAPSHOT ===\n')

  // 1. Fetch leaderboard data
  console.log('Fetching leaderboard data from Supabase...')
  const leaderboard = await getLeaderboardData()
  console.log(`  ${leaderboard.size} wallets with leaderboard points`)

  const maxPoints = Math.max(...Array.from(leaderboard.values()).map(v => v.points))
  console.log(`  Max points: ${maxPoints}`)

  // 2. Fetch transfer data
  console.log('\nFetching transfer data from Goldsky/Render...')
  const pool = new pg.Pool({ connectionString: renderPgUrl, ssl: { rejectUnauthorized: false } })
  const transfers = await getTransferData(pool)
  console.log(`  ${transfers.length} total transfers`)

  // 3. Process transfers
  const minters = new Map<string, Set<string>>()     // wallet -> set of token_ids they minted
  const currentOwner = new Map<string, string>()      // token_id -> current owner wallet
  const sellCounts = new Map<string, number>()        // wallet -> times sold
  const buyCounts = new Map<string, number>()         // wallet -> times bought (secondary)

  for (const tx of transfers) {
    const from = tx.from.toLowerCase()
    const to = tx.to.toLowerCase()
    const tokenId = tx.token_id

    if (from === ZERO_ADDRESS) {
      // Mint
      if (!minters.has(to)) minters.set(to, new Set())
      minters.get(to)!.add(tokenId)
    } else {
      // Secondary transfer
      sellCounts.set(from, (sellCounts.get(from) || 0) + 1)
      buyCounts.set(to, (buyCounts.get(to) || 0) + 1)
    }

    currentOwner.set(tokenId, to)
  }

  // 4. Build holder set + per-wallet token counts
  const holderTokens = new Map<string, number>() // wallet -> number of tokens held
  for (const [, owner] of currentOwner) {
    if (owner !== ZERO_ADDRESS) {
      holderTokens.set(owner, (holderTokens.get(owner) || 0) + 1)
    }
  }

  // 5. Fetch active listings from OpenSea
  const listedPerWallet = await getActiveListings()

  // 6. Calculate "minted and still held" per wallet
  const mintedStillHeld = new Map<string, number>()
  for (const [wallet, mintedTokens] of minters) {
    let held = 0
    for (const tokenId of mintedTokens) {
      if (currentOwner.get(tokenId) === wallet) held++
    }
    if (held > 0) mintedStillHeld.set(wallet, held)
  }

  // 7. Calculate IQ for all wallets
  const allWallets = new Set([
    ...leaderboard.keys(),
    ...holderTokens.keys(),
  ])
  allWallets.delete(DEV_WALLET)

  const results: WalletIQ[] = []

  for (const wallet of allWallets) {
    const isHolder = holderTokens.has(wallet)
    const lb = leaderboard.get(wallet)
    const points = lb?.points || 0
    const name = lb?.name || 'No Submission'

    const leaderboardIQ = calculateLeaderboardIQ(points, maxPoints)

    const minted = minters.get(wallet)?.size || 0
    const held = mintedStillHeld.get(wallet) || 0
    const sold = sellCounts.get(wallet) || 0
    const bought = buyCounts.get(wallet) || 0

    const listed = listedPerWallet.get(wallet) || 0
    const tradingIQ = (held * MINT_HELD_BONUS) + (sold * SELL_PENALTY) + (bought * BUY_BONUS) + (listed * LISTING_PENALTY)
    const totalIQPoints = leaderboardIQ + tradingIQ

    results.push({
      wallet,
      name,
      leaderboardPoints: points,
      leaderboardIQ,
      mintedCount: minted,
      mintedStillHeld: held,
      soldCount: sold,
      boughtCount: bought,
      listedCount: listed,
      tradingIQ,
      totalIQPoints,
      tokensHeld: holderTokens.get(wallet) || 0,
      isHolder,
    })
  }

  // 7. Separate holders from non-holders
  const holders = results.filter(r => r.isHolder).sort((a, b) => b.totalIQPoints - a.totalIQPoints)
  const wiped = results.filter(r => !r.isHolder && r.leaderboardPoints > 0).sort((a, b) => b.leaderboardPoints - a.leaderboardPoints)

  // 8. Print results
  console.log(`\n${'='.repeat(120)}`)
  console.log(`CURRENT HOLDERS WITH IQ POINTS (${holders.length} wallets, ${holders.reduce((s, h) => s + h.tokensHeld, 0)} savants)`)
  console.log(`${'='.repeat(120)}`)
  console.log(
    `${'#'.padStart(4)} | ${'IQ PTS'.padStart(7)} | ${'LB IQ'.padStart(6)} | ${'TRADE'.padStart(6)} | ` +
    `${'LB PTS'.padStart(6)} | ${'MINT'.padStart(4)} | ${'HELD'.padStart(4)} | ${'SOLD'.padStart(4)} | ${'BUY'.padStart(4)} | ${'LIST'.padStart(4)} | ${'TKNS'.padStart(4)} | NAME`
  )
  console.log('-'.repeat(130))

  for (let i = 0; i < Math.min(50, holders.length); i++) {
    const h = holders[i]
    console.log(
      `${(i + 1).toString().padStart(4)} | ` +
      `${h.totalIQPoints.toString().padStart(7)} | ` +
      `${h.leaderboardIQ.toString().padStart(6)} | ` +
      `${h.tradingIQ.toString().padStart(6)} | ` +
      `${h.leaderboardPoints.toString().padStart(6)} | ` +
      `${h.mintedCount.toString().padStart(4)} | ` +
      `${h.mintedStillHeld.toString().padStart(4)} | ` +
      `${h.soldCount.toString().padStart(4)} | ` +
      `${h.boughtCount.toString().padStart(4)} | ` +
      `${h.listedCount.toString().padStart(4)} | ` +
      `${h.tokensHeld.toString().padStart(4)} | ` +
      `${h.name} (${h.wallet.slice(0, 10)}...)`
    )
  }
  if (holders.length > 50) console.log(`  ... and ${holders.length - 50} more holders`)

  // Stats
  const positiveIQ = holders.filter(h => h.totalIQPoints > 0)
  const negativeIQ = holders.filter(h => h.totalIQPoints < 0)
  const zeroIQ = holders.filter(h => h.totalIQPoints === 0)
  const totalIQPool = holders.reduce((s, h) => s + Math.max(0, h.totalIQPoints), 0)

  console.log(`\n${'='.repeat(80)}`)
  console.log('HOLDER STATS')
  console.log(`${'='.repeat(80)}`)
  console.log(`  Total holders:        ${holders.length}`)
  console.log(`  Positive IQ points:   ${positiveIQ.length} wallets`)
  console.log(`  Zero IQ points:       ${zeroIQ.length} wallets`)
  console.log(`  Negative IQ points:   ${negativeIQ.length} wallets`)
  console.log(`  Total IQ pool:        ${totalIQPool} points (claimable)`)
  const totalListed = holders.reduce((s, h) => s + h.listedCount, 0)
  const walletsListing = holders.filter(h => h.listedCount > 0).length
  console.log(`  With leaderboard pts: ${holders.filter(h => h.leaderboardPoints > 0).length}`)
  console.log(`  Active listings:      ${totalListed} tokens across ${walletsListing} wallets`)

  console.log(`\n${'='.repeat(80)}`)
  console.log(`WIPED - HAD LEADERBOARD POINTS BUT NO SAVANT (${wiped.length} wallets)`)
  console.log(`${'='.repeat(80)}`)
  for (let i = 0; i < Math.min(20, wiped.length); i++) {
    const w = wiped[i]
    console.log(
      `  ${w.name.padEnd(20)} | ${w.leaderboardPoints.toString().padStart(6)} pts wiped | ` +
      `minted: ${w.mintedCount} sold: ${w.soldCount} listed: ${w.listedCount} | ${w.wallet.slice(0, 10)}...`
    )
  }
  if (wiped.length > 20) console.log(`  ... and ${wiped.length - 20} more wiped`)

  const totalWiped = wiped.reduce((s, w) => s + w.leaderboardPoints, 0)
  console.log(`  Total points wiped: ${totalWiped}`)

  // IQ distribution breakdown
  console.log(`\n${'='.repeat(80)}`)
  console.log('IQ POINTS DISTRIBUTION')
  console.log(`${'='.repeat(80)}`)
  const brackets = [
    { label: '200+', min: 200, max: Infinity },
    { label: '150-199', min: 150, max: 199 },
    { label: '100-149', min: 100, max: 149 },
    { label: '69-99', min: 69, max: 99 },
    { label: '1-68', min: 1, max: 68 },
    { label: '0', min: 0, max: 0 },
    { label: 'Negative', min: -Infinity, max: -1 },
  ]
  for (const b of brackets) {
    const count = holders.filter(h =>
      h.totalIQPoints >= b.min && h.totalIQPoints <= b.max
    ).length
    const bar = '#'.repeat(Math.ceil(count / 5))
    console.log(`  ${b.label.padEnd(10)} | ${count.toString().padStart(5)} wallets | ${bar}`)
  }

  await pool.end()

  // Save to Supabase if --save flag passed
  const shouldSave = process.argv.includes('--save')
  if (!shouldSave) {
    console.log('\nDry run complete. Pass --save to write to Supabase.')
    return
  }

  const label = process.argv.find(a => a.startsWith('--label='))?.split('=')[1] || 'snapshot'

  console.log('\n=== SAVING TO SUPABASE ===')

  const totalIQDistributed = holders.reduce((s, h) => s + Math.max(0, h.totalIQPoints), 0)

  const { data: snapshot, error: snapErr } = await supabase
    .from('iq_snapshots')
    .insert({
      label,
      total_holders: holders.length,
      total_iq_distributed: totalIQDistributed,
      notes: `Holders: ${holders.length}, Wiped: ${wiped.length}, Listed penalty: ${LISTING_PENALTY}/token`,
    })
    .select('id')
    .single()

  if (snapErr || !snapshot) {
    console.error('Failed to create snapshot:', snapErr)
    return
  }
  console.log(`  Snapshot created: ${snapshot.id}`)

  // Write wallet_iq_snapshots in batches
  const snapshotRows = holders.map(h => ({
    snapshot_id: snapshot.id,
    wallet: h.wallet,
    leaderboard_iq: h.leaderboardIQ,
    trading_iq: h.tradingIQ,
    listed_count: h.listedCount,
    total_iq_points: h.totalIQPoints,
    tokens_held: h.tokensHeld,
  }))

  const BATCH = 500
  for (let i = 0; i < snapshotRows.length; i += BATCH) {
    const batch = snapshotRows.slice(i, i + BATCH)
    const { error } = await supabase.from('wallet_iq_snapshots').insert(batch)
    if (error) {
      console.error(`  Failed batch ${i}-${i + batch.length}:`, error)
      return
    }
  }
  console.log(`  ${snapshotRows.length} wallet snapshots written`)

  // Upsert wallet_iq_balances - only for holders with positive IQ
  const balanceRows = holders
    .filter(h => h.totalIQPoints > 0)
    .map(h => ({
      wallet: h.wallet,
      total_earned: h.totalIQPoints,
      total_allocated: 0,
      last_snapshot_id: snapshot.id,
      updated_at: new Date().toISOString(),
    }))

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
  console.log('\nSnapshot saved.')
}

buildSnapshot().catch(console.error)
