import { NextRequest, NextResponse } from 'next/server'
import { getGoldskyPool } from '@/lib/goldsky'
import { supabase } from '@/lib/supabase'
import { getBaseIQ } from '@/lib/iq'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const DEV_WALLET = '0x6878144669e7e558737feb3820410174ceef04e6'

type CachedLeaderboard = {
  holders: { wallet: string; count: number; totalIQ: number }[]
  savants: { tokenId: number; iq: number; name: string | null; holder: string }[]
  fetchedAt: number
}

let cache: CachedLeaderboard | null = null
const CACHE_TTL = 120_000

export async function GET(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`lb-iq:${ip}`, { limit: 20, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const view = request.nextUrl.searchParams.get('view') || 'holders'

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    if (view === 'savants') {
      return NextResponse.json(cache.savants.slice(0, 100))
    }
    return NextResponse.json(cache.holders.slice(0, 100))
  }

  try {
    const pool = getGoldskyPool()

    const { rows: ownerRows } = await pool.query(`
      SELECT DISTINCT ON (token_id) token_id, "to" as holder
      FROM imcs_transfers
      WHERE "to" != '0x0000000000000000000000000000000000000000'
      ORDER BY token_id, block_number DESC, vid DESC
    `)

    const { data: iqRows } = await supabase
      .from('savant_iq')
      .select('token_id, iq_points, savant_name')

    const iqMap = new Map<number, { allocated: number; name: string | null }>()
    if (iqRows) {
      for (const row of iqRows) {
        iqMap.set(row.token_id, { allocated: row.iq_points || 0, name: row.savant_name || null })
      }
    }

    const holderMap = new Map<string, { count: number; totalIQ: number }>()
    const savantList: { tokenId: number; iq: number; name: string | null; holder: string }[] = []

    for (const row of ownerRows) {
      const tokenId = parseInt(row.token_id)
      const holder = row.holder?.toLowerCase()
      if (!holder || holder === DEV_WALLET) continue

      const iqData = iqMap.get(tokenId)
      const totalIQ = getBaseIQ(tokenId) + (iqData?.allocated || 0)

      savantList.push({
        tokenId,
        iq: totalIQ,
        name: iqData?.name || null,
        holder,
      })

      const existing = holderMap.get(holder) || { count: 0, totalIQ: 0 }
      holderMap.set(holder, {
        count: existing.count + 1,
        totalIQ: existing.totalIQ + totalIQ,
      })
    }

    const holders = Array.from(holderMap.entries())
      .map(([wallet, data]) => ({ wallet, count: data.count, totalIQ: data.totalIQ }))
      .sort((a, b) => b.count - a.count)

    savantList.sort((a, b) => b.iq - a.iq)

    cache = { holders, savants: savantList, fetchedAt: Date.now() }

    if (view === 'savants') {
      return NextResponse.json(savantList.slice(0, 100))
    }
    return NextResponse.json(holders.slice(0, 100))
  } catch (err) {
    console.error('Leaderboard IQ error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
