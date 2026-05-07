import { NextResponse } from 'next/server'
import { COLLECTIONS } from '@/lib/collections'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const activeSlugs = COLLECTIONS.filter(c => !c.closed).map(c => c.slug)

    const counts: Record<string, number> = {}

    if (activeSlugs.length > 0) {
      const { data, error } = await supabase
        .from('community_claims')
        .select('collection_slug')
        .in('collection_slug', activeSlugs)

      if (error) {
        console.error('Claims query error:', error.message)
      } else if (data) {
        for (const row of data) {
          counts[row.collection_slug] = (counts[row.collection_slug] || 0) + 1
        }
      }
    }

    const collections = COLLECTIONS.map(c => {
      const claimed = counts[c.slug] ?? 0
      return {
        slug: c.slug,
        name: c.name,
        displayName: c.displayName,
        chainId: c.chainId,
        cap: c.cap,
        claimed: c.closed ? c.cap : claimed,
        spotsRemaining: c.closed ? 0 : c.cap - claimed,
        logo: c.logo || null,
      }
    })

    return NextResponse.json(
      { collections },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', Pragma: 'no-cache' } }
    )
  } catch (error) {
    console.error('Community status error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
