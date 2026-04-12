/**
 * Client-side API helpers
 * These functions call our Next.js API routes
 * Safe to use in client components
 */

// Type definitions (shared with server)
export type Submission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
  created_at: string
  referrer_code?: string
}

export type UserProfile = {
  wallet_address: string
  name: string
  info: string
  submission_score: number
  submitted_at: string
  referrer_code?: string
  voting_karma: number
  whitelist_status: string
  whitelist_method?: string
  referrals_made: number
}

export type LeaderboardSubmission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
  created_at: string
  total_votes: number
  upvotes: number
  downvotes: number
  whitelist_status?: string
}

export type LeaderboardVoter = {
  wallet_address: string
  votes_cast: number
  weighted_votes: number
  karma_score: number
  whitelist_status?: string
}

export type VoteResponse = {
  success: boolean
  message: string
  submission?: Submission
}

export type SubmitResponse = {
  success: boolean
  message: string
  submission?: Submission
  referrer_code?: string
}

// Helper function to get client IP (using external service)
async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch {
    return '0.0.0.0'
  }
}

// ========================================
// SUBMISSIONS API
// ========================================

/**
 * Submit form data (wallet, name, info)
 * Also submits to Google Sheets as backup
 */
export async function submitForm(data: {
  wallet_address: string
  name: string
  info: string
  referrer_code?: string
}): Promise<SubmitResponse> {
  const response = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Submission failed')
  }

  return response.json()
}

/**
 * Get random submission for voting
 * Excludes submissions the user has already voted on
 */
export async function getRandomSubmission(params?: {
  voterWallet?: string
  excludeIds?: string[]
}): Promise<Submission | null> {
  const searchParams = new URLSearchParams()

  if (params?.voterWallet) {
    searchParams.set('voterWallet', params.voterWallet)
  }

  if (params?.excludeIds && params.excludeIds.length > 0) {
    searchParams.set('excludeIds', params.excludeIds.join(','))
  }

  const response = await fetch(`/api/submissions/random?${searchParams}`)

  if (!response.ok) {
    return null
  }

  return response.json()
}

// ========================================
// VOTING API
// ========================================

/**
 * Cast a vote (upvote or downvote)
 * Automatically determines voter identifier (wallet or IP)
 */
export async function castVote(data: {
  submissionId: string
  voteType: 'upvote' | 'downvote'
  voterWallet?: string  // If connected, use wallet. Otherwise use IP
}): Promise<VoteResponse> {
  // Get IP if no wallet
  let voterIP: string | undefined
  if (!data.voterWallet) {
    voterIP = await getClientIP()
  }

  const response = await fetch('/api/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submissionId: data.submissionId,
      voteType: data.voteType,
      voterWallet: data.voterWallet,
      voterIP,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Vote failed')
  }

  return response.json()
}

// ========================================
// PROFILE API
// ========================================

/**
 * Get user profile by wallet address
 */
export async function getProfile(walletAddress: string): Promise<UserProfile | null> {
  const response = await fetch(`/api/profile/${walletAddress}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('Failed to fetch profile')
  }

  return response.json()
}

// ========================================
// LEADERBOARD API
// ========================================

/**
 * Get top submissions leaderboard
 */
export async function getLeaderboardSubmissions(limit = 100, includeInfo = false): Promise<LeaderboardSubmission[]> {
  const response = await fetch(`/api/leaderboard/submissions?limit=${limit}${includeInfo ? '&include=info' : ''}`)

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard')
  }

  return response.json()
}

/**
 * Get top voters leaderboard
 */
export async function getLeaderboardVoters(limit = 100): Promise<LeaderboardVoter[]> {
  const response = await fetch(`/api/leaderboard/voters?limit=${limit}`)

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard')
  }

  return response.json()
}

/**
 * Search for specific wallet on leaderboard
 */
export async function searchLeaderboard(walletAddress: string): Promise<{
  submission?: LeaderboardSubmission & { rank: number }
  voter?: LeaderboardVoter & { rank: number }
} | null> {
  const response = await fetch(`/api/leaderboard/search?wallet=${walletAddress}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('Failed to search leaderboard')
  }

  return response.json()
}

// ========================================
// WHITELIST API
// ========================================

/**
 * Check if wallet is whitelisted
 */
export async function checkWhitelist(walletAddress: string): Promise<{
  whitelisted: boolean
  status?: 'approved' | 'pending' | 'rejected'
  method?: string
}> {
  const response = await fetch(`/api/whitelist/check?wallet=${walletAddress}`)

  if (!response.ok) {
    return { whitelisted: false }
  }

  return response.json()
}

// ========================================
// ACCESS ATTEMPTS API (Circle/Typing Tests)
// ========================================

/**
 * Record circle drawing attempt
 */
export async function recordCircleAttempt(data: {
  success: boolean
  score: number
}): Promise<{ success: boolean; failedAttempts: number }> {
  const ip = await getClientIP()

  const response = await fetch('/api/access/circle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ip,
      success: data.success,
      score: data.score,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to record attempt')
  }

  return response.json()
}

/**
 * Get number of failed circle attempts for current IP
 */
export async function getFailedCircleAttempts(): Promise<number> {
  const ip = await getClientIP()

  const response = await fetch(`/api/access/circle?ip=${ip}`)

  if (!response.ok) {
    return 0
  }

  const data = await response.json()
  return data.failedAttempts || 0
}

/**
 * Record typing test attempt
 */
export async function recordTypingAttempt(data: {
  success: boolean
  wpm: number
}): Promise<{ success: boolean }> {
  const ip = await getClientIP()

  const response = await fetch('/api/access/typing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ip,
      success: data.success,
      wpm: data.wpm,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to record attempt')
  }

  return response.json()
}
