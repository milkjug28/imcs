import { NextResponse } from 'next/server'
import { COLLECTIONS } from '@/lib/collections'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const activeSlugs = COLLECTIONS.filter(c => !c.closed).map(c => c.slug)

    const counts: Record<string, number> = {}

    if (activeSlugs.length > 0) {
      const results = await Promise.all(
        activeSlugs.map(slug =>
          supabase
            .from('community_claims')
            .select('*', { count: 'exact', head: true })
            .eq('collection_slug', slug)
            .then(({ count, error }) => {
              if (error) console.error(`Count error for ${slug}:`, error.message)
              return { slug, count: count ?? 0 }
            })
        )
      )
      for (const r of results) {
        counts[r.slug] = r.count
      }
    }

    console.log('Community status counts:', JSON.stringify(counts))

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
      { collections, _debug: { counts, supabaseUrl: process.env.SUPABASE_URL?.slice(0, 30), hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY } },
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
