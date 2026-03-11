import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    // Rate limit: 30 requests per minute per IP
    const ip = getRequestIP(request)
    const rl = rateLimit(`profile:${ip}`, { limit: 30, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'slow down dummie' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const wallet = params.wallet.toLowerCase()

    // 1. Fetch task completions
    const { data: taskCompletions } = await supabase
      .from('task_completions')
      .select('score')
      .eq('wallet_address', wallet)

    const taskPoints = (taskCompletions || []).reduce(
      (sum, t) => sum + (t.score || 0), 0
    )

    // 2. Query the user_profiles view
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', wallet)
      .single()

    // Base profile if not found
    let baseProfile = profile || {
      wallet_address: wallet,
      name: 'Unknown Savant',
      info: 'No info yet',
      submission_score: 0,
      voting_karma: 0,
      referrals_made: 0,
      whitelist_status: 'pending',
    }

    // 3. Calculate voting karma - include both wallet-based and IP-based votes
    let votingKarma = baseProfile.voting_karma || 0
    let submissionScore = Number(baseProfile.submission_score) || 0

    if (profile) {
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
    } else {
        // If no profile, they might still have voted based on wallet
        const { data: walletVotes } = await supabase
          .from('votes')
          .select('id')
          .eq('voter_identifier', wallet)
        if (walletVotes) {
            votingKarma += walletVotes.length
        }
    }

    // Calculate total points
    const totalPoints = submissionScore + votingKarma + taskPoints

    // Auto-approve whitelist if total points meet threshold
    const MIN_WL_POINTS = 1017
    let whitelistStatus = baseProfile.whitelist_status
    let whitelistMethod = baseProfile.whitelist_method

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

    // Get Rank using the leaderboard_scores view
    // A user's rank is 1 + the number of users who have a strictly greater total_points
    // We only calculate this if they have some points
    let rank: number | null = null
    if (totalPoints > 0) {
        const { count, error: rankError } = await supabase
          .from('leaderboard_scores')
          .select('*', { count: 'exact', head: true })
          .gt('total_points', totalPoints)
          
        if (!rankError && count !== null) {
            rank = count + 1
        }
    }

    return NextResponse.json({
      ...baseProfile,
      has_submission: !!profile,
      submission_score: submissionScore,
      voting_karma: votingKarma,
      task_points: taskPoints,
      total_points: totalPoints,
      rank,
      whitelist_status: whitelistStatus,
      whitelist_method: whitelistMethod,
    })
  } catch (error) {
    console.error('Profile error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
