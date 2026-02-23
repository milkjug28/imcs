import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

    // Fetch task completions and sum their points
    const { data: taskCompletions } = await supabase
      .from('task_completions')
      .select('score')
      .eq('wallet_address', wallet)

    const taskPoints = (taskCompletions || []).reduce(
      (sum, t) => sum + (t.score || 0), 0
    )

    // Calculate voting karma - include both wallet-based and IP-based votes
    let votingKarma = profile.voting_karma || 0

    // Get the user's submission to find their IP address
    const { data: submission } = await supabase
      .from('submissions')
      .select('ip_address')
      .eq('wallet_address', wallet)
      .single()

    if (submission?.ip_address) {
      // Count votes made from this IP address
      const { data: ipVotes } = await supabase
        .from('votes')
        .select('id')
        .eq('voter_identifier', submission.ip_address)

      if (ipVotes) {
        votingKarma += ipVotes.length
      }
    }

    // Calculate total points
    const submissionScore = Number(profile.submission_score) || 0
    const totalPoints = submissionScore + votingKarma + taskPoints

    // Auto-approve whitelist if total points meet threshold
    const MIN_WL_POINTS = 1017
    let whitelistStatus = profile.whitelist_status
    let whitelistMethod = profile.whitelist_method

    if (totalPoints >= MIN_WL_POINTS && whitelistStatus !== 'approved') {
      // Upsert whitelist entry
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

      whitelistStatus = 'approved'
      whitelistMethod = 'auto_points'
    }

    return NextResponse.json({
      ...profile,
      submission_score: submissionScore,
      voting_karma: votingKarma,
      task_points: taskPoints,
      total_points: totalPoints,
      whitelist_status: whitelistStatus,
      whitelist_method: whitelistMethod,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Profile error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
