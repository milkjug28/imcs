import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const file of ['.env', '.env.local']) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const DEV_WALLET = '0x6878144669e7e558737feb3820410174ceef04e6'

async function check() {
  const pool = new pg.Pool({ connectionString: process.env.RENDER_POSTGRES_URL!, ssl: { rejectUnauthorized: false } })

  const { rows } = await pool.query(`
    WITH current_owners AS (
      SELECT DISTINCT ON (token_id) token_id, "to" as holder
      FROM imcs_transfers ORDER BY token_id, block_number DESC, vid DESC
    )
    SELECT holder, COUNT(*)::int as cnt FROM current_owners
    WHERE holder != '0x0000000000000000000000000000000000000000'
    GROUP BY holder
    ORDER BY cnt DESC
  `)

  console.log('Total unique holders from Goldsky:', rows.length)
  console.log('Total tokens held:', rows.reduce((s: number, r: any) => s + r.cnt, 0))

  const devRow = rows.find((r: any) => r.holder === DEV_WALLET)
  if (devRow) console.log('Dev wallet holds:', devRow.cnt, 'tokens')

  // Excluding dev wallet
  const withoutDev = rows.filter((r: any) => r.holder !== DEV_WALLET)
  console.log('Holders excluding dev:', withoutDev.length)

  // Check for 1-token holders that might be edge cases
  const singleHolders = rows.filter((r: any) => r.cnt === 1)
  console.log('Single-token holders:', singleHolders.length)

  // Latest block
  const { rows: latest } = await pool.query('SELECT MAX(block_number)::text as max_block FROM imcs_transfers')
  console.log('Latest block in Goldsky:', latest[0].max_block)

  // Total tokens minted
  const { rows: minted } = await pool.query(`
    SELECT COUNT(DISTINCT token_id)::int as total FROM imcs_transfers
    WHERE "from" = '0x0000000000000000000000000000000000000000'
  `)
  console.log('Total tokens minted:', minted[0].total)

  // Burned tokens (sent to zero address after mint)
  const { rows: burned } = await pool.query(`
    WITH current_owners AS (
      SELECT DISTINCT ON (token_id) token_id, "to" as holder
      FROM imcs_transfers ORDER BY token_id, block_number DESC, vid DESC
    )
    SELECT COUNT(*)::int as total FROM current_owners
    WHERE holder = '0x0000000000000000000000000000000000000000'
  `)
  console.log('Burned tokens:', burned[0].total)

  await pool.end()
}

check().catch(console.error)
