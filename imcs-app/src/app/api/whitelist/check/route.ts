import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const wallet = searchParams.get('wallet')?.toLowerCase()

    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet address required' },
        { status: 400 }
      )
    }

    // Check whitelist table
    const { data: whitelistEntry } = await supabase
      .from('whitelist')
      .select('status, method')
      .eq('wallet_address', wallet)
      .single()

    if (whitelistEntry && whitelistEntry.status === 'approved') {
      return NextResponse.json({
        whitelisted: true,
        status: whitelistEntry.status,
        method: whitelistEntry.method,
      })
    }

    // Not whitelisted yet - check if they're eligible based on score
    const { data: submission } = await supabase
      .from('submissions')
      .select('score')
      .eq('wallet_address', wallet)
      .single()

    if (submission && submission.score >= 3) {
      // Eligible! Run auto-update
      await supabase.rpc('update_whitelist_auto')

      return NextResponse.json({
        whitelisted: true,
        status: 'approved',
        method: 'auto_score',
      })
    }

    return NextResponse.json({
      whitelisted: false,
      status: whitelistEntry?.status || 'not_eligible',
      method: whitelistEntry?.method,
    })
  } catch (error) {
    console.error('Whitelist check error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
