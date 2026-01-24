import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')

    // Query the leaderboard_submissions view (has vote-based scores)
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

    // Fetch all task completions to add task points
    const { data: taskCompletions } = await supabase
      .from('task_completions')
      .select('wallet_address, score')

    // Create a map of wallet -> total task points
    const taskPointsMap = new Map<string, number>()
    if (taskCompletions) {
      for (const task of taskCompletions) {
        const wallet = task.wallet_address.toLowerCase()
        const current = taskPointsMap.get(wallet) || 0
        taskPointsMap.set(wallet, current + (task.score || 0))
      }
    }

    // Get all submissions to map IP -> wallet for voting karma
    const { data: submissions } = await supabase
      .from('submissions')
      .select('wallet_address, ip_address')

    // Create IP -> wallet map
    const ipToWalletMap = new Map<string, string>()
    if (submissions) {
      for (const sub of submissions) {
        if (sub.ip_address) {
          ipToWalletMap.set(sub.ip_address, sub.wallet_address.toLowerCase())
        }
      }
    }

    // Fetch all votes to calculate voting karma
    const { data: allVotes } = await supabase
      .from('votes')
      .select('voter_identifier')

    // Count votes per wallet (voting karma)
    const votingKarmaMap = new Map<string, number>()
    if (allVotes) {
      for (const vote of allVotes) {
        let wallet: string | undefined
        
        // If voter_identifier is a wallet address (starts with 0x)
        if (vote.voter_identifier.startsWith('0x')) {
          wallet = vote.voter_identifier.toLowerCase()
        } else {
          // It's an IP address - look up the wallet
          wallet = ipToWalletMap.get(vote.voter_identifier)
        }
        
        if (wallet) {
          const current = votingKarmaMap.get(wallet) || 0
          votingKarmaMap.set(wallet, current + 1)
        }
      }
    }

    // Calculate total points for each submission
    const leaderboardWithTasks = (leaderboard || []).map(sub => {
      const wallet = sub.wallet_address.toLowerCase()
      const taskPoints = taskPointsMap.get(wallet) || 0
      const votingKarma = votingKarmaMap.get(wallet) || 0
      const submissionScore = Number(sub.score) || 0
      
      return {
        ...sub,
        task_points: taskPoints,
        voting_karma: votingKarma,
        // Total score = submission_score + voting_karma + task_points (matches profile page)
        score: submissionScore + votingKarma + taskPoints
      }
    })

    // Re-sort by total score (descending)
    leaderboardWithTasks.sort((a, b) => b.score - a.score)

    return NextResponse.json(leaderboardWithTasks, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
