import { supabase } from './supabase'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || ''
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'

const CACHE_TTL = 120_000 // 2 min fresh
const STALE_TTL = 3_600_000 // 60 min stale-while-error

const ownershipCache = new Map<
  string,
  { tokenIds: number[]; fetchedAt: number }
>()

async function fetchTokenIdsFromAlchemy(wallet: string): Promise<number[]> {
  if (!ALCHEMY_KEY) throw new Error('no alchemy key')

  const tokenIds: number[] = []
  let pageKey: string | undefined

  do {
    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=${SAVANT_TOKEN}&withMetadata=false&pageSize=100${pageKey ? `&pageKey=${pageKey}` : ''}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`alchemy ${res.status}`)
    const data = await res.json()
    for (const nft of data.ownedNfts || []) {
      tokenIds.push(parseInt(nft.tokenId))
    }
    pageKey = data.pageKey
  } while (pageKey)

  return tokenIds
}

async function readSupabaseCache(
  wallet: string,
): Promise<number[] | null> {
  try {
    const { data } = await supabase
      .from('holder_cache')
      .select('token_ids')
      .eq('wallet_address', wallet)
      .single()
    return data?.token_ids ?? null
  } catch {
    return null
  }
}

function writeSupabaseCache(wallet: string, tokenIds: number[]): void {
  Promise.resolve(
    supabase
      .from('holder_cache')
      .upsert(
        {
          wallet_address: wallet,
          token_ids: tokenIds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' },
      ),
  ).catch(() => {})
}

export async function getOwnedTokenIds(
  wallet: string,
): Promise<{ tokenIds: number[]; fromCache: boolean }> {
  const normalized = wallet.toLowerCase()

  const cached = ownershipCache.get(normalized)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { tokenIds: cached.tokenIds, fromCache: true }
  }

  try {
    const tokenIds = await fetchTokenIdsFromAlchemy(normalized)
    ownershipCache.set(normalized, { tokenIds, fetchedAt: Date.now() })
    writeSupabaseCache(normalized, tokenIds)
    return { tokenIds, fromCache: false }
  } catch {
    if (cached && Date.now() - cached.fetchedAt < STALE_TTL) {
      return { tokenIds: cached.tokenIds, fromCache: true }
    }

    const fromDb = await readSupabaseCache(normalized)
    if (fromDb) {
      ownershipCache.set(normalized, {
        tokenIds: fromDb,
        fetchedAt: Date.now() - CACHE_TTL + 30_000,
      })
      return { tokenIds: fromDb, fromCache: true }
    }

    throw new Error('ownership data unavailable')
  }
}

// Authorization check for mutation routes (IQ allocate, naming, trait equip).
// Always hits Alchemy live and fails closed - cached/stale ownership must never
// authorize a state change (a seller could act on tokens they no longer own).
// Callers must catch and return 502 so the client can retry.
export async function verifyOwnership(
  wallet: string,
  tokenIds: number[],
): Promise<boolean> {
  const normalized = wallet.toLowerCase()
  const owned = await fetchTokenIdsFromAlchemy(normalized)
  ownershipCache.set(normalized, { tokenIds: owned, fetchedAt: Date.now() })
  writeSupabaseCache(normalized, owned)
  const ownedSet = new Set(owned)
  return tokenIds.every((id) => ownedSet.has(id))
}

export async function getHoldingCount(
  wallet: string,
): Promise<{ count: number; fromCache: boolean }> {
  const { tokenIds, fromCache } = await getOwnedTokenIds(wallet)
  return { count: tokenIds.length, fromCache }
}
