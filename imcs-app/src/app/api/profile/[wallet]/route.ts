import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const wallet = params.wallet.toLowerCase()

    // Query the user_profiles view
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', wallet)
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { error: 'ur wallet not savant yet. submit form first, nerd' },
        { status: 404 }
      )
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Profile error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
