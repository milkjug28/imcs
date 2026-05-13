import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { config } from './config'
import { TTLCache } from './utils/cache'

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const metadataCache = new TTLCache<SavantMetadata>()

interface SavantMetadata {
  tokenId: number
  name: string
  image: string
  attributes: { trait_type: string; value: string }[]
  iq: number
  savantName: string | null
  rarity: string | null
}

const ONE_OF_ONE_TOKENS = new Set([315, 851, 1023, 1865, 2902, 3541, 4248])

function getBaseIQ(tokenId: number): number {
  return ONE_OF_ONE_TOKENS.has(tokenId) ? 111 : 69
}

export async function getSavantMetadata(tokenId: number): Promise<SavantMetadata | null> {
  const cached = metadataCache.get(String(tokenId))
  if (cached) return cached

  const [metaResult, iqResult] = await Promise.all([
    supabase.from('savant_metadata').select('name, image, attributes').eq('token_id', tokenId).single(),
    supabase.from('savant_iq').select('iq_points, savant_name').eq('token_id', tokenId).single(),
  ])

  if (!metaResult.data) return null

  const allocated = iqResult.data?.iq_points ?? 0
  const totalIQ = getBaseIQ(tokenId) + allocated
  const attrs = (metaResult.data.attributes as { trait_type: string; value: string }[]) || []

  const result: SavantMetadata = {
    tokenId,
    name: metaResult.data.name,
    image: metaResult.data.image,
    attributes: attrs,
    iq: totalIQ,
    savantName: iqResult.data?.savant_name || null,
    rarity: null,
  }

  metadataCache.set(String(tokenId), result, 5 * 60_000)
  return result
}

export async function getRandomSavant(): Promise<SavantMetadata | null> {
  const tokenId = Math.floor(Math.random() * config.totalSupply) + 1
  return getSavantMetadata(tokenId)
}

export async function searchSavantsByTrait(traitType: string, value: string): Promise<number[]> {
  const { data } = await supabase
    .from('savant_metadata')
    .select('token_id')
    .contains('attributes', [{ trait_type: traitType, value }])
    .limit(20)

  return (data || []).map((r: { token_id: number }) => r.token_id)
}
