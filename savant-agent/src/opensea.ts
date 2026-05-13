import { config } from './config'
import { log, logError } from './utils/log'

interface SaleEvent {
  price: number
  seller: string
  buyer: string
  token: string
  timestamp: number
}

export interface CollectionStats {
  floorPrice: number
  totalListings: number
  recentSales: SaleEvent[]
  whales: { address: string; count: number }[]
  jeets: { address: string; count: number }[]
  summary: string
  fetchedAt: number
}

let cached: CollectionStats | null = null
const CACHE_TTL = 90_000

async function fetchJSON(url: string) {
  const res = await fetch(url, {
    headers: { 'x-api-key': config.openseaKey },
  })
  if (!res.ok) return null
  return res.json()
}

export async function getCollectionStats(): Promise<CollectionStats | null> {
  if (!config.openseaKey) return null
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached

  try {
    const [listingsData, salesData] = await Promise.all([
      fetchJSON(`https://api.opensea.io/api/v2/listings/collection/${config.collectionSlug}/all?limit=50`),
      fetchJSON(`https://api.opensea.io/api/v2/events/collection/${config.collectionSlug}?event_type=sale&limit=50`),
    ])

    const listings = listingsData?.listings || []
    const sales: SaleEvent[] = (salesData?.asset_events || []).map((e: Record<string, unknown>) => {
      const payment = e.payment as Record<string, unknown> | undefined
      return {
        price: payment?.quantity ? Number(payment.quantity as string) / 1e18 : 0,
        seller: (e.seller as string || '').slice(0, 10),
        buyer: (e.buyer as string || '').slice(0, 10),
        token: (e.nft as Record<string, unknown>)?.identifier as string || '?',
        timestamp: e.event_timestamp as number || 0,
      }
    })

    let floorPrice = 0
    if (listings.length > 0) {
      const prices = listings
        .map((l: Record<string, unknown>) => {
          const price = l.price as Record<string, unknown> | undefined
          const current = price?.current as Record<string, unknown> | undefined
          return current?.value ? Number(current.value as string) / 1e18 : 999
        })
        .sort((a: number, b: number) => a - b)
      floorPrice = prices[0]
    }

    const buyerCounts: Record<string, number> = {}
    const sellerCounts: Record<string, number> = {}
    for (const s of sales) {
      buyerCounts[s.buyer] = (buyerCounts[s.buyer] || 0) + 1
      sellerCounts[s.seller] = (sellerCounts[s.seller] || 0) + 1
    }

    const whales = Object.entries(buyerCounts)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([address, count]) => ({ address, count }))

    const jeets = Object.entries(sellerCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([address, count]) => ({ address, count }))

    const parts: string[] = []
    parts.push(`IMCS is MINTED OUT (4269/4269)`)
    if (floorPrice > 0) parts.push(`floor: ${floorPrice.toFixed(4)} ETH`)
    parts.push(`${listings.length} listed`)
    if (sales.length > 0) {
      const avgPrice = sales.reduce((s, e) => s + e.price, 0) / sales.length
      parts.push(`recent avg sale: ${avgPrice.toFixed(4)} ETH`)
    }
    if (whales.length > 0) {
      parts.push(`whales buying: ${whales.map(w => w.address + '(' + w.count + ')').join(', ')}`)
    }
    if (jeets.length > 0) {
      parts.push(`jeets selling: ${jeets.map(j => j.address + '(' + j.count + ')').join(', ')}`)
    }
    const lastSale = sales[0]
    if (lastSale) {
      parts.push(`last sale: ${lastSale.price.toFixed(4)} ETH`)
    }

    cached = {
      floorPrice,
      totalListings: listings.length,
      recentSales: sales,
      whales,
      jeets,
      summary: parts.join('. '),
      fetchedAt: Date.now(),
    }

    log(`[opensea] refreshed: floor=${floorPrice.toFixed(4)} listings=${listings.length} sales=${sales.length}`)
    return cached
  } catch (err) {
    logError('[opensea] fetch failed', err)
    return cached
  }
}

export function getCachedStats(): CollectionStats | null {
  return cached
}
