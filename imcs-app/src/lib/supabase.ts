/**
 * Server-side Supabase client
 * Uses service role key - ONLY import this in API routes or server components
 * NEVER import this in client components
 */

import { createClient } from '@supabase/supabase-js'

// Server-side only - uses service role key
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Type definitions
export type Submission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
  created_at: string
  ip_address?: string
  referrer_code?: string
}

export type Vote = {
  id: string
  submission_id: string
  voter_identifier: string
  vote_type: 'upvote' | 'downvote'
  vote_weight: number
  created_at: string
}

export type AccessAttempt = {
  id: string
  ip_address: string
  attempt_type: 'circle' | 'typing'
  success: boolean
  score?: number
  created_at: string
}

export type Whitelist = {
  id: string
  wallet_address: string
  status: 'approved' | 'pending' | 'rejected'
  method?: string
  notes?: string
  added_at: string
  updated_at: string
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
