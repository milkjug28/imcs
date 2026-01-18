import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')

    // Query the leaderboard_submissions view
    const { data: leaderboard, error } = await supabase
      .from('leaderboard_submissions')
      .select('*')
      .limit(Math.min(limit, 1000)) // Max 1000 for safety

    if (error) {
      console.error('Leaderboard error:', error)
      return NextResponse.json(
        { error: 'failed to fetch leaderboard' },
        { status: 500 }
      )
    }

    return NextResponse.json(leaderboard || [])
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
