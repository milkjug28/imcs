import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')

    if (!wallet || !ETH_ADDRESS_RE.test(wallet)) {
      return NextResponse.json(
        { claim: null },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const normalized = wallet.toLowerCase()

    const { data } = await supabase
      .from('community_claims')
      .select('collection_slug, mint_wallet, claimed_at')
      .eq('holder_wallet', normalized)
      .single()

    return NextResponse.json(
      { claim: data || null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { claim: null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
