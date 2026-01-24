import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')

    // Get ALL submissions directly (for submission_score and user info)
    // This matches exactly what profile API does
    // Normalize wallet_address to lowercase in the query
    const { data: allSubmissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('wallet_address, name, info, score, ip_address, created_at')
      .order('created_at', { ascending: false })

    if (submissionsError) {
      console.error('Leaderboard submissions error:', submissionsError)
      return NextResponse.json(
        { error: 'failed to fetch submissions' },
        { status: 500 }
      )
    }

    if (!allSubmissions || allSubmissions.length === 0) {
      return NextResponse.json([])
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

    // Create IP -> wallet map for voting karma calculation
    const ipToWalletMap = new Map<string, string>()
    if (allSubmissions) {
      for (const sub of allSubmissions) {
        if (sub.ip_address) {
          ipToWalletMap.set(sub.ip_address, sub.wallet_address.toLowerCase())
        }
      }
    }

    // Calculate voting karma - EXACTLY like profile API does
    // First get wallet-based votes (like user_profiles view does)
    const { data: walletVotes } = await supabase
      .from('votes')
      .select('voter_identifier')
      .like('voter_identifier', '0x%')

    // Count wallet-based votes per wallet
    const votingKarmaMap = new Map<string, number>()
    if (walletVotes) {
      for (const vote of walletVotes) {
        const wallet = vote.voter_identifier.toLowerCase()
        const current = votingKarmaMap.get(wallet) || 0
        votingKarmaMap.set(wallet, current + 1)
      }
    }

    // Then add IP-based votes (like profile API does)
    const { data: ipVotes } = await supabase
      .from('votes')
      .select('voter_identifier')
      .not('voter_identifier', 'like', '0x%')

    if (ipVotes) {
      for (const vote of ipVotes) {
        const wallet = ipToWalletMap.get(vote.voter_identifier)
        if (wallet) {
          const current = votingKarmaMap.get(wallet) || 0
          votingKarmaMap.set(wallet, current + 1)
        }
      }
    }

    // Calculate total points for each user - EXACTLY like profile API
    const leaderboardEntries = (allSubmissions || []).map(sub => {
      const wallet = (sub.wallet_address || '').toLowerCase()
      if (!wallet) return null // Skip invalid entries
      
      const taskPoints = taskPointsMap.get(wallet) || 0
      const votingKarma = votingKarmaMap.get(wallet) || 0
      // Handle both string and number types for score
      const submissionScore = typeof sub.score === 'string' 
        ? parseFloat(sub.score) || 0 
        : Number(sub.score) || 0
      
      // Total = submission_score + voting_karma + task_points (EXACT match to profile)
      const totalPoints = submissionScore + votingKarma + taskPoints
      
      return {
        wallet_address: sub.wallet_address,
        name: sub.name || 'Unknown',
        info: sub.info || '',
        score: totalPoints, // This is the TOTAL score used for ranking
        submission_score: submissionScore,
        voting_karma: votingKarma,
        task_points: taskPoints,
        created_at: sub.created_at,
        whitelist_status: null // Can add this later if needed
      }
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    // Also include users who have points but no submission (from tasks or voting only)
    // Get all unique wallets from task completions and votes
    const allWalletsWithPoints = new Set<string>()
    
    // Add wallets from task completions
    if (taskCompletions) {
      taskCompletions.forEach(t => allWalletsWithPoints.add(t.wallet_address.toLowerCase()))
    }
    
    // Add wallets from wallet-based votes
    if (walletVotes) {
      walletVotes.forEach(v => {
        allWalletsWithPoints.add(v.voter_identifier.toLowerCase())
      })
    }
    
    // Add wallets from IP-based votes (that we can map to a wallet)
    if (ipVotes) {
      ipVotes.forEach(v => {
        const wallet = ipToWalletMap.get(v.voter_identifier)
        if (wallet) allWalletsWithPoints.add(wallet)
      })
    }

    // Add entries for users with points but no submission
    allWalletsWithPoints.forEach(wallet => {
      const hasSubmission = leaderboardEntries.some(e => e.wallet_address.toLowerCase() === wallet)
      if (!hasSubmission) {
        const taskPoints = taskPointsMap.get(wallet) || 0
        const votingKarma = votingKarmaMap.get(wallet) || 0
        const totalPoints = votingKarma + taskPoints
        
        // Only add if they have points
        if (totalPoints > 0) {
          leaderboardEntries.push({
            wallet_address: wallet,
            name: 'Anonymous Savant',
            info: 'has points but no submission yet',
            score: totalPoints,
            submission_score: 0,
            voting_karma: votingKarma,
            task_points: taskPoints,
            created_at: new Date().toISOString(),
            whitelist_status: null
          })
        }
      }
    })

    // Sort by total score (descending) - EXACTLY like profile page expects
    leaderboardEntries.sort((a, b) => b.score - a.score)

    // Limit results
    const limited = leaderboardEntries.slice(0, Math.min(limit, 1000))

    return NextResponse.json(limited, {
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
