import { log, logError } from '../utils/log'
import { TTLCache } from '../utils/cache'

interface CoinPrice {
  usd: number
  usd_24h_change: number
  usd_market_cap: number
}

export interface MarketData {
  prices: Record<string, CoinPrice>
  gasGwei: number | null
  fetchedAt: number
}

const cache = new TTLCache<MarketData>()
const CACHE_TTL = 3 * 60_000

const COINS = [
  'bitcoin', 'ethereum', 'solana', 'chainlink', 'uniswap',
  'aave', 'lido-dao', 'arbitrum', 'optimism', 'polygon-ecosystem-token',
  'pepe', 'dogecoin',
]

const TICKER_MAP: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', chainlink: 'LINK',
  uniswap: 'UNI', aave: 'AAVE', 'lido-dao': 'LDO', arbitrum: 'ARB',
  optimism: 'OP', 'polygon-ecosystem-token': 'POL', pepe: 'PEPE', dogecoin: 'DOGE',
}

export async function getMarketData(): Promise<MarketData | null> {
  const cached = cache.get('market')
  if (cached) return cached

  try {
    const ids = COINS.join(',')
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
    )
    if (!res.ok) return null
    const data = await res.json()

    const prices: Record<string, CoinPrice> = {}
    for (const [id, vals] of Object.entries(data)) {
      const v = vals as Record<string, number>
      const ticker = TICKER_MAP[id] || id.toUpperCase()
      prices[ticker] = {
        usd: v.usd || 0,
        usd_24h_change: v.usd_24h_change || 0,
        usd_market_cap: v.usd_market_cap || 0,
      }
    }

    let gasGwei: number | null = null
    try {
      const gasRes = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle')
      if (gasRes.ok) {
        const gasData = await gasRes.json()
        gasGwei = gasData?.result?.ProposeGasPrice ? Number(gasData.result.ProposeGasPrice) : null
      }
    } catch { /* gas is optional */ }

    const result: MarketData = { prices, gasGwei, fetchedAt: Date.now() }
    cache.set('market', result, CACHE_TTL)
    log(`[market] refreshed: ${Object.keys(prices).length} tokens`)
    return result
  } catch (err) {
    logError('[market] fetch failed', err)
    return null
  }
}

export function marketSummary(data: MarketData): string {
  const lines: string[] = ['LIVE MARKET DATA:']
  for (const [ticker, p] of Object.entries(data.prices)) {
    const dir = p.usd_24h_change >= 0 ? '+' : ''
    lines.push(`${ticker}: $${p.usd.toLocaleString()} (${dir}${p.usd_24h_change.toFixed(1)}% 24h)`)
  }
  if (data.gasGwei) {
    lines.push(`ETH gas: ${data.gasGwei} gwei`)
  }
  return lines.join('\n')
}
