import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Minimum total points required for automatic whitelist
const MIN_WL_POINTS = 1017

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

    // Check whitelist table first (manual/collab entries)
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

    // Not manually whitelisted — check total points
    // Calculate total points the same way the profile & leaderboard APIs do:
    // total = submission_score + voting_karma + task_points

    // 1. Submission score
    const { data: submission } = await supabase
      .from('submissions')
      .select('score, ip_address')
      .eq('wallet_address', wallet)
      .single()

    const submissionScore = submission ? (Number(submission.score) || 0) : 0

    // 2. Task points
    const { data: taskCompletions } = await supabase
      .from('task_completions')
      .select('score')
      .eq('wallet_address', wallet)

    const taskPoints = (taskCompletions || []).reduce(
      (sum, t) => sum + (t.score || 0), 0
    )

    // 3. Voting karma (wallet-based votes)
    const { data: walletVotes } = await supabase
      .from('votes')
      .select('id')
      .eq('voter_identifier', wallet)

    let votingKarma = walletVotes ? walletVotes.length : 0

    // Also count IP-based votes if we can match them
    if (submission?.ip_address) {
      const { data: ipVotes } = await supabase
        .from('votes')
        .select('id')
        .eq('voter_identifier', submission.ip_address)

      if (ipVotes) {
        votingKarma += ipVotes.length
      }
    }

    const totalPoints = submissionScore + votingKarma + taskPoints

    if (totalPoints >= MIN_WL_POINTS) {
      // Auto-approve: upsert into whitelist table
      const { data: existingWl } = await supabase
        .from('whitelist')
        .select('id')
        .eq('wallet_address', wallet)
        .single()

      if (existingWl) {
        await supabase
          .from('whitelist')
          .update({ status: 'approved', method: 'auto_points', updated_at: new Date().toISOString() })
          .eq('wallet_address', wallet)
      } else {
        await supabase
          .from('whitelist')
          .insert({ wallet_address: wallet, status: 'approved', method: 'auto_points' })
      }

      return NextResponse.json({
        whitelisted: true,
        status: 'approved',
        method: 'auto_points',
        total_points: totalPoints,
        min_required: MIN_WL_POINTS,
      })
    }

    return NextResponse.json({
      whitelisted: false,
      status: whitelistEntry?.status || 'not_eligible',
      method: whitelistEntry?.method,
      total_points: totalPoints,
      min_required: MIN_WL_POINTS,
      points_needed: MIN_WL_POINTS - totalPoints,
    })
  } catch (error) {
    console.error('Whitelist check error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
