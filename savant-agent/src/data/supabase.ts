import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { config } from '../config'
import { TTLCache } from '../utils/cache'

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const metadataCache = new TTLCache<SavantMetadata>()

export interface SavantMetadata {
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

export interface UserContext {
  discordUserId: string
  wallets: string[]
  tokenCount: number
  tiers: string[]
  iqBalance: { totalEarned: number; totalAllocated: number; available: number } | null
}

export async function getUserContext(discordUserId: string): Promise<UserContext | null> {
  const { data: verification } = await supabase
    .from('discord_verifications')
    .select('wallet_address, token_count, tiers')
    .eq('discord_user_id', discordUserId)
    .single()

  if (!verification) return null

  const { data: extraWallets } = await supabase
    .from('discord_wallets')
    .select('wallet_address')
    .eq('discord_user_id', discordUserId)

  const wallets = [verification.wallet_address]
  if (extraWallets) {
    for (const w of extraWallets) {
      if (!wallets.includes(w.wallet_address)) wallets.push(w.wallet_address)
    }
  }

  let iqBalance = null
  const { data: iq } = await supabase
    .from('wallet_iq_balances')
    .select('total_earned, total_allocated, available')
    .eq('wallet', verification.wallet_address)
    .single()

  if (iq) {
    iqBalance = {
      totalEarned: iq.total_earned || 0,
      totalAllocated: iq.total_allocated || 0,
      available: iq.available || 0,
    }
  }

  return {
    discordUserId,
    wallets,
    tokenCount: verification.token_count || 0,
    tiers: verification.tiers || [],
    iqBalance,
  }
}
