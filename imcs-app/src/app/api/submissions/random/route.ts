import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const voterWallet = searchParams.get('voterWallet')
    const excludeIds = searchParams.get('excludeIds')?.split(',').filter(Boolean) || []

    // Get all submissions the voter hasn't voted on yet
    let query = supabase
      .from('submissions')
      .select('*')

    // If voter wallet provided, exclude submissions they've already voted on
    if (voterWallet) {
      const { data: votedSubmissions } = await supabase
        .from('votes')
        .select('submission_id')
        .eq('voter_identifier', voterWallet.toLowerCase())

      const votedIds = votedSubmissions?.map((v: any) => v.submission_id) || []

      // Also exclude their own submission
      const { data: ownSubmission } = await supabase
        .from('submissions')
        .select('id')
        .eq('wallet_address', voterWallet.toLowerCase())
        .single()

      if (ownSubmission) {
        votedIds.push(ownSubmission.id)
      }

      // Combine with excludeIds
      const allExcluded = [...new Set([...votedIds, ...excludeIds])]

      if (allExcluded.length > 0) {
        query = query.not('id', 'in', `(${allExcluded.join(',')})`)
      }
    } else if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data: submissions, error } = await query

    if (error) {
      console.error('Query error:', error)
      return NextResponse.json(
        { error: 'failed to fetch submissions' },
        { status: 500 }
      )
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json(
        { message: 'no more submissions to vote on' },
        { status: 404 }
      )
    }

    // Return random submission
    const randomIndex = Math.floor(Math.random() * submissions.length)
    return NextResponse.json(submissions[randomIndex])
  } catch (error) {
    console.error('Random submission error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
