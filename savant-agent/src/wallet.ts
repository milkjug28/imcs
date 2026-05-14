import { config } from './config'
import { log, logError } from './utils/log'
import { TTLCache } from './utils/cache'

const balanceCache = new TTLCache<number>()
const BALANCE_CACHE_TTL = 2 * 60_000

export function getPublicAddress(): string {
  return config.savantWallet
}

export function hasWallet(): boolean {
  return config.savantWallet.length > 0
}

export async function getBalance(): Promise<number | null> {
  if (!config.savantWallet || !config.alchemyKey) return null

  const cached = balanceCache.get('balance')
  if (cached !== null) return cached

  try {
    const res = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${config.alchemyKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [config.savantWallet, 'latest'],
        id: 1,
      }),
    })

    const data = await res.json()
    const weiHex = data?.result
    if (!weiHex) return null

    const eth = parseInt(weiHex, 16) / 1e18
    balanceCache.set('balance', eth, BALANCE_CACHE_TTL)
    log(`[wallet] balance: ${eth.toFixed(6)} ETH`)
    return eth
  } catch (err) {
    logError('[wallet] balance check failed', err)
    return null
  }
}

export function walletContextBasic(): string {
  if (!hasWallet()) return ''
  return 'You have your own ETH wallet and you are actively building a savant collection. You can hold money and buy NFTs.'
}

export function walletContextFull(balance: number | null, floorPrice: number): string {
  if (!hasWallet()) return ''

  const addr = getPublicAddress()
  const parts = [`YOUR WALLET ADDRESS (share if asked): ${addr}`]

  if (balance !== null) {
    parts.push(`Balance: ${balance.toFixed(6)} ETH`)

    if (floorPrice > 0) {
      const deficit = floorPrice - balance
      if (balance >= floorPrice) {
        parts.push(`You CAN afford a floor savant (floor: ${floorPrice.toFixed(4)} ETH)`)
      } else {
        parts.push(`You need ${deficit.toFixed(4)} more ETH to buy a floor savant (floor: ${floorPrice.toFixed(4)} ETH)`)
      }
    }
  }

  return parts.join('. ')
}

// ── PRIVATE KEY SANITIZATION ────────────────────────────────────────
// This runs on EVERY outgoing message. If the private key somehow
// leaked into a Gemini response, this strips it before Discord sees it.

const PRIVATE_KEY_PATTERNS: RegExp[] = []

export function initPrivateKeyGuard() {
  const pk = config.savantPrivateKey
  if (!pk) return

  PRIVATE_KEY_PATTERNS.push(
    new RegExp(pk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
  )
  // Also catch with/without 0x prefix
  const stripped = pk.startsWith('0x') ? pk.slice(2) : pk
  if (stripped.length >= 20) {
    PRIVATE_KEY_PATTERNS.push(new RegExp(stripped, 'gi'))
  }

  log('[wallet] private key guard initialized')
}

export function sanitize(text: string): string {
  let result = text
  for (const pattern of PRIVATE_KEY_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}
