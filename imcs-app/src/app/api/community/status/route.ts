import { NextResponse } from 'next/server'
import { COLLECTIONS } from '@/lib/collections'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const results = await Promise.all(
      COLLECTIONS.map(c =>
        supabase
          .from('community_claims')
          .select('*', { count: 'exact', head: true })
          .eq('collection_slug', c.slug)
          .then(({ count }) => ({ slug: c.slug, count: count ?? 0 }))
      )
    )

    const claimCounts: Record<string, number> = {}
    for (const r of results) {
      claimCounts[r.slug] = r.count
    }

    const collections = COLLECTIONS.map(c => ({
      slug: c.slug,
      name: c.name,
      displayName: c.displayName,
      chainId: c.chainId,
      cap: c.cap,
      claimed: claimCounts[c.slug] || 0,
      spotsRemaining: c.cap - (claimCounts[c.slug] || 0),
      logo: c.logo || null,
    }))

    return NextResponse.json(
      { collections },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Community status error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
