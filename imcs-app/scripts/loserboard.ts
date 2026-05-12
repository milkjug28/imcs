import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const file of ['.env', '.env.local']) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim()
    }
  } catch {}
}

const DEV_WALLET = '0x6878144669e7e558737feb3820410174ceef04e6'

async function loserboard() {
  const pool = new pg.Pool({
    connectionString: process.env.RENDER_POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  })

  const { rows } = await pool.query(`
    WITH minters AS (
      SELECT "to" as wallet, token_id FROM imcs_transfers
      WHERE "from" = '0x0000000000000000000000000000000000000000'
    ),
    current_owners AS (
      SELECT DISTINCT ON (token_id) token_id, "to" as holder
      FROM imcs_transfers ORDER BY token_id, block_number DESC, vid DESC
    ),
    sells AS (
      SELECT "from" as wallet, COUNT(*) as sold FROM imcs_transfers
      WHERE "from" != '0x0000000000000000000000000000000000000000'
      GROUP BY "from"
    ),
    buys AS (
      SELECT "to" as wallet, COUNT(*) as bought FROM imcs_transfers
      WHERE "from" != '0x0000000000000000000000000000000000000000'
      GROUP BY "to"
    ),
    mint_held AS (
      SELECT m.wallet, COUNT(*) as held FROM minters m
      JOIN current_owners co ON m.token_id = co.token_id AND m.wallet = co.holder
      GROUP BY m.wallet
    ),
    held_counts AS (
      SELECT holder as wallet, COUNT(*) as tokens_held FROM current_owners
      WHERE holder != '0x0000000000000000000000000000000000000000'
        AND holder != $1
      GROUP BY holder
    ),
    wallet_iq AS (
      SELECT h.wallet, h.tokens_held,
        COALESCE(mh.held, 0) * 5 + COALESCE(s.sold, 0) * -10 + COALESCE(b.bought, 0) * 2 as trade_iq,
        COALESCE(s.sold, 0) as sold,
        COALESCE(b.bought, 0) as bought,
        COALESCE(mh.held, 0) as mint_held
      FROM held_counts h
      LEFT JOIN sells s ON h.wallet = s.wallet
      LEFT JOIN buys b ON h.wallet = b.wallet
      LEFT JOIN mint_held mh ON h.wallet = mh.wallet
    )
    SELECT wallet, tokens_held, trade_iq, sold, bought, mint_held
    FROM wallet_iq
    WHERE trade_iq < 0
    ORDER BY trade_iq ASC
  `, [DEV_WALLET])

  console.log('=== LOSERBOARD ===\n')
  console.log(
    `${'#'.padStart(4)} | ${'IQ'.padStart(6)} | ${'HELD'.padStart(4)} | ${'SOLD'.padStart(4)} | ${'BUY'.padStart(4)} | ${'MHLD'.padStart(4)} | WALLET`
  )
  console.log('-'.repeat(75))

  let totalHeld = 0
  let totalSold = 0
  let totalBought = 0

  for (const [i, r] of rows.entries()) {
    totalHeld += Number(r.tokens_held)
    totalSold += Number(r.sold)
    totalBought += Number(r.bought)
    if (i < 30) {
      console.log(
        `${(i + 1).toString().padStart(4)} | ` +
        `${r.trade_iq.toString().padStart(6)} | ` +
        `${r.tokens_held.toString().padStart(4)} | ` +
        `${r.sold.toString().padStart(4)} | ` +
        `${r.bought.toString().padStart(4)} | ` +
        `${r.mint_held.toString().padStart(4)} | ` +
        `${r.wallet.slice(0, 10)}...`
      )
    }
  }
  if (rows.length > 30) console.log(`  ... and ${rows.length - 30} more losers`)

  const avg = (totalHeld / rows.length).toFixed(1)

  // Distribution of how negative
  const brackets = [
    { label: '-1 to -10', min: -10, max: -1 },
    { label: '-11 to -30', min: -30, max: -11 },
    { label: '-31 to -60', min: -60, max: -31 },
    { label: '-61 to -100', min: -100, max: -61 },
    { label: '-100+', min: -Infinity, max: -101 },
  ]

  console.log(`\n=== LOSERBOARD STATS ===`)
  console.log(`  Total losers:         ${rows.length}`)
  console.log(`  Total savants held:   ${totalHeld}`)
  console.log(`  Avg savants held:     ${avg}`)
  console.log(`  Total times sold:     ${totalSold}`)
  console.log(`  Total times bought:   ${totalBought}`)
  console.log(`  Avg sells per loser:  ${(totalSold / rows.length).toFixed(1)}`)
  console.log(`  Most negative:        ${rows[0].trade_iq} IQ pts`)

  // How many hold just 1
  const hold1 = rows.filter(r => Number(r.tokens_held) === 1).length
  const hold2to5 = rows.filter(r => Number(r.tokens_held) >= 2 && Number(r.tokens_held) <= 5).length
  const hold5plus = rows.filter(r => Number(r.tokens_held) > 5).length

  console.log(`\n=== HOW MANY SAVANTS DO LOSERS HOLD? ===`)
  console.log(`  Hold 1 savant:    ${hold1} wallets`)
  console.log(`  Hold 2-5 savants: ${hold2to5} wallets`)
  console.log(`  Hold 5+ savants:  ${hold5plus} wallets`)

  console.log(`\n=== HOW NEGATIVE? ===`)
  for (const b of brackets) {
    const count = rows.filter(r => Number(r.trade_iq) >= b.min && Number(r.trade_iq) <= b.max).length
    const bar = '█'.repeat(Math.ceil(count / 2))
    console.log(`  ${b.label.padEnd(12)} | ${count.toString().padStart(4)} wallets | ${bar}`)
  }

  await pool.end()
}

loserboard().catch(console.error)
