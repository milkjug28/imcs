import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calculateVoteWeight, getVoteResponse } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { submissionId, voteType, voterWallet, voterIP } = body

    // Validation
    if (!submissionId || !voteType) {
      return NextResponse.json(
        { error: 'missing fields dummie' },
        { status: 400 }
      )
    }

    if (voteType !== 'upvote' && voteType !== 'downvote') {
      return NextResponse.json(
        { error: 'vote type must be upvote or downvote' },
        { status: 400 }
      )
    }

    // Determine voter identifier (wallet takes priority over IP)
    const voterIdentifier = voterWallet || voterIP
    if (!voterIdentifier) {
      return NextResponse.json(
        { error: 'need wallet or IP to vote' },
        { status: 400 }
      )
    }

    // Calculate vote weight
    const voteWeight = calculateVoteWeight(!!voterWallet)

    // Check if submission exists
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('id, wallet_address')
      .eq('id', submissionId)
      .single()

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'submission not found' },
        { status: 404 }
      )
    }

    // Prevent voting on own submission
    if (voterWallet && submission.wallet_address.toLowerCase() === voterWallet.toLowerCase()) {
      return NextResponse.json(
        { error: 'u cant vote on ur own submission dummie 🤡' },
        { status: 400 }
      )
    }

    // Check for duplicate vote
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id, vote_type')
      .eq('submission_id', submissionId)
      .eq('voter_identifier', voterIdentifier.toLowerCase())
      .single()

    if (existingVote) {
      return NextResponse.json(
        { error: 'u alredy voted on dis one, dummy' },
        { status: 400 }
      )
    }

    // Insert vote
    const { error: voteError } = await supabase
      .from('votes')
      .insert({
        submission_id: submissionId,
        voter_identifier: voterIdentifier.toLowerCase(),
        vote_type: voteType,
        vote_weight: voteWeight,
      })

    if (voteError) {
      console.error('Vote error:', voteError)
      return NextResponse.json(
        { error: 'failed to save vote' },
        { status: 500 }
      )
    }

    // Get updated submission
    const { data: updatedSubmission } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    return NextResponse.json({
      success: true,
      message: getVoteResponse(),
      submission: updatedSubmission,
    })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
