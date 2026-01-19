import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Get a random submission for voting
 * GET /api/vote/random
 */
export async function GET() {
  try {
    // Get all submissions with their current scores
    const { data: submissions, error } = await supabase
      .from('leaderboard_submissions')
      .select('id, wallet_address, name, info, score')
      .order('id')

    if (error) {
      console.error('Error fetching submissions:', error)
      return NextResponse.json(
        { error: 'failed to fetch submissions' },
        { status: 500 }
      )
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json(
        { error: 'no submissions available' },
        { status: 404 }
      )
    }

    // Return a random submission
    const randomIndex = Math.floor(Math.random() * submissions.length)
    const randomSubmission = submissions[randomIndex]

    return NextResponse.json(randomSubmission)
  } catch (error) {
    console.error('Random submission error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
