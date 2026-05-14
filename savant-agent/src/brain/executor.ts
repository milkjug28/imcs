import { getCollectionStats } from '../data/opensea'
import { getMarketData, marketSummary } from '../data/market'
import { getSavantMetadata, searchSavantsByTrait, getUserContext } from '../data/supabase'
import { getBalance, getPublicAddress, getOwnedSavantsCached } from '../data/wallet'
import { buyFloor, getOwnedSavants } from '../data/trading'
import { recallMemory, saveMemory } from '../memory/store'
import type { MemoryType } from '../memory/types'
import { log } from '../utils/log'

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  async check_floor_price() {
    const stats = await getCollectionStats()
    if (!stats) return { error: 'could not fetch stats' }
    return {
      floor_eth: stats.floorPrice,
      listed_count: stats.totalListings >= 50 ? '50+' : stats.totalListings,
      summary: stats.summary,
    }
  },

  async get_collection_stats() {
    const stats = await getCollectionStats()
    if (!stats) return { error: 'could not fetch stats' }
    return {
      floor_eth: stats.floorPrice,
      listed_count: stats.totalListings >= 50 ? '50+' : stats.totalListings,
      whales: stats.whales,
      jeets: stats.jeets,
      recent_sales: stats.recentSales.slice(0, 5).map(s => ({
        price_eth: s.price,
        token: s.token,
        buyer: s.buyer,
        seller: s.seller,
      })),
      summary: stats.summary,
    }
  },

  async get_market_data() {
    const data = await getMarketData()
    if (!data) return { error: 'market data unavailable' }
    return {
      prices: data.prices,
      gas_gwei: data.gasGwei,
      summary: marketSummary(data),
    }
  },

  async lookup_savant(args) {
    const tokenId = args.token_id as number
    if (!tokenId || tokenId < 1 || tokenId > 4269) {
      return { error: 'token_id must be 1-4269' }
    }
    const meta = await getSavantMetadata(tokenId)
    if (!meta) return { error: `savant #${tokenId} not found` }
    return {
      token_id: meta.tokenId,
      name: meta.name,
      iq: meta.iq,
      savant_name: meta.savantName,
      traits: meta.attributes.map(a => `${a.trait_type}: ${a.value}`),
    }
  },

  async search_by_trait(args) {
    const traitType = args.trait_type as string
    const value = args.value as string
    if (!traitType || !value) return { error: 'need trait_type and value' }
    const ids = await searchSavantsByTrait(traitType, value)
    return { matching_token_ids: ids, count: ids.length }
  },

  async check_wallet_balance() {
    const balance = await getBalance()
    const address = getPublicAddress()
    const owned = await getOwnedSavantsCached()
    return {
      balance_eth: balance,
      address: address || null,
      owned_count: owned.length,
      owned_ids: owned,
    }
  },

  async get_owned_savants() {
    const owned = await getOwnedSavants()
    return { owned_token_ids: owned, count: owned.length }
  },

  async buy_savant(args) {
    const confirm = args.confirm as string
    if (confirm !== 'yes_buy_floor') {
      return { error: 'must pass confirm: "yes_buy_floor" to execute purchase' }
    }
    const result = await buyFloor()
    return result
  },

  async get_user_context(args) {
    const discordUserId = args.discord_user_id as string
    if (!discordUserId) return { error: 'need discord_user_id' }
    const ctx = await getUserContext(discordUserId)
    if (!ctx) return { error: 'user not found or not verified' }
    return ctx
  },

  async recall_memory(args) {
    const query = args.query as string
    const subject = args.subject as string | undefined
    if (!query) return { error: 'need query' }
    const memories = await recallMemory(query, subject)
    return {
      memories: memories.map(m => ({
        content: m.content,
        type: m.memory_type,
        salience: m.salience,
        created_at: m.created_at,
      })),
      count: memories.length,
    }
  },

  async save_memory(args) {
    const memoryType = args.memory_type as MemoryType
    const content = args.content as string
    const subject = args.subject as string | undefined
    if (!memoryType || !content) return { error: 'need memory_type and content' }
    const saved = await saveMemory(memoryType, content, subject)
    return { saved }
  },
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const handler = TOOL_HANDLERS[name]
  if (!handler) return { error: `unknown tool: ${name}` }

  log(`[executor] running ${name}(${JSON.stringify(args).slice(0, 100)})`)

  try {
    return await handler(args)
  } catch (err) {
    log(`[executor] ${name} failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return { error: err instanceof Error ? err.message : 'tool execution failed' }
  }
}
