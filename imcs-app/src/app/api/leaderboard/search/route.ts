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

    const result: any = {}

    // Search in submissions leaderboard
    const { data: allSubmissions } = await supabase
      .from('leaderboard_submissions')
      .select('*')
      .order('score', { ascending: false })

    if (allSubmissions) {
      const submissionIndex = allSubmissions.findIndex(
        s => s.wallet_address.toLowerCase() === wallet
      )

      if (submissionIndex !== -1) {
        result.submission = {
          ...allSubmissions[submissionIndex],
          rank: submissionIndex + 1,
        }
      }
    }

    // Search in voters leaderboard
    const { data: allVoters } = await supabase
      .from('leaderboard_voters')
      .select('*')
      .order('karma_score', { ascending: false })

    if (allVoters) {
      const voterIndex = allVoters.findIndex(
        v => v.wallet_address.toLowerCase() === wallet
      )

      if (voterIndex !== -1) {
        result.voter = {
          ...allVoters[voterIndex],
          rank: voterIndex + 1,
        }
      }
    }

    if (!result.submission && !result.voter) {
      return NextResponse.json(
        { error: 'wallet not found on leaderboard' },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
