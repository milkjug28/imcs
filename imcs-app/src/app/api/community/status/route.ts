import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { COLLECTIONS } from '@/lib/collections'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data: counts } = await supabase
      .from('community_claims')
      .select('collection_slug')

    const claimCounts: Record<string, number> = {}
    if (counts) {
      for (const row of counts) {
        claimCounts[row.collection_slug] = (claimCounts[row.collection_slug] || 0) + 1
      }
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
