import { log, logError } from './utils/log'
import { TTLCache } from './utils/cache'

const cache = new TTLCache<MarketData>()
const CACHE_TTL = 3 * 60_000

const TRACKED_IDS = [
  'bitcoin', 'ethereum', 'solana', 'chainlink',
  'uniswap', 'aave', 'lido-dao', 'arbitrum',
  'optimism', 'polygon-ecosystem-token', 'pepe', 'dogecoin',
]

interface CoinData {
  usd: number
  usd_24h_change: number
  usd_market_cap: number
}

export interface MarketData {
  prices: Record<string, CoinData>
  ethGas: number | null
  fetchedAt: number
}

const DISPLAY_NAMES: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  chainlink: 'LINK',
  uniswap: 'UNI',
  aave: 'AAVE',
  'lido-dao': 'LDO',
  arbitrum: 'ARB',
  optimism: 'OP',
  'polygon-ecosystem-token': 'POL',
  pepe: 'PEPE',
  dogecoin: 'DOGE',
}

export async function getMarketData(): Promise<MarketData | null> {
  const cached = cache.get('market')
  if (cached) return cached

  try {
    const ids = TRACKED_IDS.join(',')
    const [priceRes, gasRes] = await Promise.all([
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd').catch(() => null),
    ])

    if (!priceRes.ok) {
      logError('[market] CoinGecko error', priceRes.status)
      return null
    }

    const priceData = await priceRes.json()

    let ethGas: number | null = null
    try {
      const gasApiRes = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle')
      if (gasApiRes.ok) {
        const gasData = await gasApiRes.json()
        ethGas = gasData?.result?.ProposeGasPrice ? Number(gasData.result.ProposeGasPrice) : null
      }
    } catch { /* gas is optional */ }

    const result: MarketData = {
      prices: priceData,
      ethGas,
      fetchedAt: Date.now(),
    }

    cache.set('market', result, CACHE_TTL)
    log(`[market] refreshed: BTC=$${priceData.bitcoin?.usd} ETH=$${priceData.ethereum?.usd}`)
    return result
  } catch (err) {
    logError('[market] fetch failed', err)
    return null
  }
}

export function marketSummary(data: MarketData): string {
  const lines: string[] = []

  for (const [id, coin] of Object.entries(data.prices)) {
    const ticker = DISPLAY_NAMES[id] || id.toUpperCase()
    const d = coin as CoinData
    if (!d.usd) continue

    const price = d.usd >= 1 ? `$${d.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `$${d.usd.toPrecision(4)}`
    const change = d.usd_24h_change?.toFixed(1) || '?'
    const dir = d.usd_24h_change >= 0 ? '+' : ''
    lines.push(`${ticker}: ${price} (${dir}${change}% 24h)`)
  }

  if (data.ethGas) {
    lines.push(`ETH gas: ${data.ethGas} gwei`)
  }

  return 'LIVE MARKET DATA:\n' + lines.join('\n')
}
