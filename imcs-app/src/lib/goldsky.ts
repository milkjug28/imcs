import pg from 'pg'

let pool: pg.Pool | null = null

export function getGoldskyPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.RENDER_POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    })
  }
  return pool
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const MINT_HELD_BONUS = 5
const SELL_PENALTY = -10
const BUY_BONUS = 2
const LISTING_PENALTY = -1

export interface LiveTradingIQ {
  mintedHeld: number
  sold: number
  bought: number
  tradingIQ: number
}

export async function getLiveTradingIQ(wallet: string): Promise<LiveTradingIQ> {
  const pool = getGoldskyPool()
  const w = wallet.toLowerCase()

  const { rows } = await pool.query(`
    WITH minted AS (
      SELECT token_id FROM imcs_transfers
      WHERE "from" = $1 AND "to" = $2
    ),
    current_owners AS (
      SELECT DISTINCT ON (token_id) token_id, "to" as holder
      FROM imcs_transfers ORDER BY token_id, block_number DESC, vid DESC
    ),
    mint_held AS (
      SELECT COUNT(*) as cnt FROM minted m
      JOIN current_owners co ON m.token_id = co.token_id AND co.holder = $2
    ),
    sells AS (
      SELECT COUNT(*) as cnt FROM imcs_transfers
      WHERE "from" = $2 AND "from" != $1
    ),
    buys AS (
      SELECT COUNT(*) as cnt FROM imcs_transfers
      WHERE "to" = $2 AND "from" != $1
    )
    SELECT
      (SELECT cnt FROM mint_held)::int as mint_held,
      (SELECT cnt FROM sells)::int as sold,
      (SELECT cnt FROM buys)::int as bought
  `, [ZERO_ADDRESS, w])

  const r = rows[0] || { mint_held: 0, sold: 0, bought: 0 }
  const mintedHeld = r.mint_held || 0
  const sold = r.sold || 0
  const bought = r.bought || 0

  const tradingIQ = (mintedHeld * MINT_HELD_BONUS) + (sold * SELL_PENALTY) + (bought * BUY_BONUS)

  return { mintedHeld, sold, bought, tradingIQ }
}
