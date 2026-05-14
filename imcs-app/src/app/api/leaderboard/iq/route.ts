import { NextRequest, NextResponse } from 'next/server'
import { getGoldskyPool } from '@/lib/goldsky'
import { supabase } from '@/lib/supabase'
import { getBaseIQ } from '@/lib/iq'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const DEV_WALLET = '0x6878144669e7e558737feb3820410174ceef04e6'

export async function GET(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`lb-iq:${ip}`, { limit: 20, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const view = request.nextUrl.searchParams.get('view') || 'holders'

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

    const metaMap = new Map<number, { image: string | null; attributes: { trait_type: string; value: string }[] }>()
    let metaFrom = 0
    const META_PAGE = 1000
    while (true) {
      const { data: metaRows } = await supabase
        .from('savant_metadata')
        .select('token_id, image, attributes')
        .range(metaFrom, metaFrom + META_PAGE - 1)
      if (!metaRows || metaRows.length === 0) break
      for (const row of metaRows) {
        metaMap.set(row.token_id, { image: row.image || null, attributes: row.attributes || [] })
      }
      if (metaRows.length < META_PAGE) break
      metaFrom += META_PAGE
    }

    const holderMap = new Map<string, { count: number; totalIQ: number }>()
    const savantList: { tokenId: number; iq: number; name: string | null; holder: string; image: string | null; traits: { trait_type: string; value: string }[] }[] = []

    for (const row of ownerRows) {
      const tokenId = parseInt(row.token_id)
      const holder = row.holder?.toLowerCase()
      if (!holder || holder === DEV_WALLET) continue

      const iqData = iqMap.get(tokenId)
      const meta = metaMap.get(tokenId)
      const totalIQ = getBaseIQ(tokenId) + (iqData?.allocated || 0)

      savantList.push({
        tokenId,
        iq: totalIQ,
        name: iqData?.name || null,
        holder,
        image: meta?.image || null,
        traits: (meta?.attributes || []).filter(a => a.trait_type !== 'Trait Count' && a.trait_type !== 'IQ'),
      })

      const existing = holderMap.get(holder) || { count: 0, totalIQ: 0 }
      holderMap.set(holder, {
        count: existing.count + 1,
        totalIQ: existing.totalIQ + totalIQ,
      })
    }

    if (view === 'savants') {
      savantList.sort((a, b) => b.iq - a.iq)
      return NextResponse.json(savantList.slice(0, 100))
    }

    const holders = Array.from(holderMap.entries())
      .map(([wallet, data]) => ({ wallet, count: data.count, totalIQ: data.totalIQ }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json(holders.slice(0, 100))
  } catch (err) {
    console.error('Leaderboard IQ error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
