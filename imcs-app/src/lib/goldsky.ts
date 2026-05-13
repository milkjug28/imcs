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

const OPENSEA_COLLECTION = 'imaginary-magic-crypto-savants'
const OPENSEA_KEYS = [
  process.env.OPENSEA_API_KEY!,
  process.env.OPENSEA_API_KEY_2,
].filter(Boolean) as string[]

const SAVANT_CONTRACT = '0x95fa6fc553f5be3160b191b0133236367a835c63'

async function getOpenSeaSales(wallet: string): Promise<number> {
  let sold = 0
  let next: string | undefined

  for (const key of OPENSEA_KEYS) {
    try {
      do {
        const url = new URL(`https://api.opensea.io/api/v2/events/accounts/${wallet}`)
        url.searchParams.set('event_type', 'sale')
        url.searchParams.set('collection_slug', OPENSEA_COLLECTION)
        url.searchParams.set('limit', '50')
        if (next) url.searchParams.set('next', next)

        const res = await fetch(url.toString(), {
          headers: { 'x-api-key': key },
          cache: 'no-store',
        })

        if (!res.ok) break

        const data = await res.json()
        const events = data.asset_events || []

        for (const event of events) {
          const nft = event.nft
          if (nft?.contract?.toLowerCase() === SAVANT_CONTRACT && event.seller?.toLowerCase() === wallet.toLowerCase()) {
            sold++
          }
        }

        next = data.next || undefined
      } while (next)

      return sold
    } catch {
      continue
    }
  }

  return sold
}

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
    buys AS (
      SELECT COUNT(*) as cnt FROM imcs_transfers
      WHERE "to" = $2 AND "from" != $1
    )
    SELECT
      (SELECT cnt FROM mint_held)::int as mint_held,
      (SELECT cnt FROM buys)::int as bought
  `, [ZERO_ADDRESS, w])

  const r = rows[0] || { mint_held: 0, bought: 0 }
  const mintedHeld = r.mint_held || 0
  const bought = r.bought || 0
  const sold = await getOpenSeaSales(wallet)

  const tradingIQ = (mintedHeld * MINT_HELD_BONUS) + (sold * SELL_PENALTY) + (bought * BUY_BONUS)

  return { mintedHeld, sold, bought, tradingIQ }
}
