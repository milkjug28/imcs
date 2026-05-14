import { config } from '../config'
import { log, logError } from '../utils/log'
import { TTLCache } from '../utils/cache'

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

const ownedCache = new TTLCache<string[]>()

export async function getOwnedSavantsCached(): Promise<string[]> {
  const cached = ownedCache.get('owned')
  if (cached) return cached

  if (!config.alchemyKey || !config.savantWallet) return []

  try {
    const res = await fetch(
      `https://eth-mainnet.g.alchemy.com/nft/v3/${config.alchemyKey}/getNFTsForOwner?owner=${config.savantWallet}&contractAddresses[]=${config.contractAddress}&withMetadata=false`
    )
    if (!res.ok) return []
    const data = await res.json() as { ownedNfts?: { tokenId: string }[] }
    const ids = (data.ownedNfts || []).map((n: { tokenId: string }) => n.tokenId)
    ownedCache.set('owned', ids, 5 * 60_000)
    return ids
  } catch {
    return []
  }
}

export async function walletContextBasic(): Promise<string> {
  if (!hasWallet()) return ''

  const [balance, owned] = await Promise.all([getBalance(), getOwnedSavantsCached()])

  const parts: string[] = []
  if (balance !== null) {
    parts.push(`Your wallet balance: ${balance.toFixed(4)} ETH`)
  }
  if (owned.length > 0) {
    parts.push(`You own ${owned.length} savant(s): #${owned.join(', #')}`)
  } else {
    parts.push(`You own 0 savants. You don't have any yet.`)
  }
  parts.push('NEVER make up how many savants you own or fabricate token IDs. Only reference real data above.')

  return parts.join('. ')
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

const PRIVATE_KEY_PATTERNS: RegExp[] = []

export function initPrivateKeyGuard() {
  const pk = config.savantPrivateKey
  if (!pk) return

  PRIVATE_KEY_PATTERNS.push(
    new RegExp(pk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
  )
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
  // Strip leaked tool call markup (DeepSeek outputs fake XML tool calls as text)
  result = result.replace(/<\s*\|?\s*DSML\s*\|?[\s\S]*?<\/\s*\|?\s*DSML\s*\|?\s*tool_calls\s*>/gi, '')
  result = result.replace(/<\s*tool_call[\s\S]*?<\/\s*tool_call\s*>/gi, '')
  result = result.replace(/<\|.*?\|>/g, '')
  result = result.trim()

  // Reject gibberish - if >30% non-Latin characters, response is garbage
  const nonLatin = result.replace(/[\x00-\x7F]/g, '').length
  if (result.length > 10 && nonLatin / result.length > 0.3) {
    return ''
  }

  return result
}
