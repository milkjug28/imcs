import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Get WL claim status for a wallet
 */
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase()

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 })
    }

    // Get whitelist entry
    const { data: wl } = await supabase
      .from('whitelist')
      .select('status, method, x_username, x_user_id, tweet_link, claimed, claimed_at')
      .eq('wallet_address', wallet)
      .single()

    // Calculate total points (same as profile API)
    const { data: submission } = await supabase
      .from('submissions')
      .select('score, ip_address')
      .eq('wallet_address', wallet)
      .single()

    const submissionScore = submission ? (Number(submission.score) || 0) : 0

    const { data: taskCompletions } = await supabase
      .from('task_completions')
      .select('score')
      .eq('wallet_address', wallet)

    const taskPoints = (taskCompletions || []).reduce((sum, t) => sum + (t.score || 0), 0)

    const { data: walletVotes } = await supabase
      .from('votes')
      .select('id')
      .eq('voter_identifier', wallet)

    let votingKarma = walletVotes ? walletVotes.length : 0

    if (submission?.ip_address) {
      const { data: ipVotes } = await supabase
        .from('votes')
        .select('id')
        .eq('voter_identifier', submission.ip_address)
      if (ipVotes) votingKarma += ipVotes.length
    }

    const totalPoints = submissionScore + votingKarma + taskPoints
    const isWhitelisted = totalPoints >= 1017 || wl?.status === 'approved'

    return NextResponse.json({
      whitelisted: isWhitelisted,
      total_points: totalPoints,
      min_required: 1017,
      x_linked: !!wl?.x_username,
      x_username: wl?.x_username || null,
      claimed: wl?.claimed || false,
      claimed_at: wl?.claimed_at || null,
      tweet_link: wl?.tweet_link || null,
      status: wl?.status || 'not_found',
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    console.error('WL status error:', error)
    return NextResponse.json({ error: 'sumthin went wrong' }, { status: 500 })
  }
}
