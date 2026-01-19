'use client'

import { useState, useEffect } from 'react'
import VotingCard from '@/components/VotingCard'
import { getVoteResponse } from '@/lib/utils'

type Submission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
}

export default function VotePage() {
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [voterWallet, setVoterWallet] = useState<string | null>(null)
  const [showResponse, setShowResponse] = useState(false)
  const [voteResponseText, setVoteResponseText] = useState('')

  // Load voted IDs from localStorage
  useEffect(() => {
    const savedVotedIds = localStorage.getItem('votedSubmissions')
    if (savedVotedIds) {
      try {
        const parsed = JSON.parse(savedVotedIds)
        setVotedIds(new Set(parsed))
      } catch (e) {
        console.error('Failed to parse voted IDs:', e)
      }
    }

    // Check if wallet is connected (we'll implement wallet connection later)
    // For now, just use null (IP-only voting)
    setVoterWallet(null)

    loadNextSubmission()
  }, [])

  // Save voted IDs to localStorage
  useEffect(() => {
    if (votedIds.size > 0) {
      localStorage.setItem('votedSubmissions', JSON.stringify(Array.from(votedIds)))
    }
  }, [votedIds])

  const loadNextSubmission = async () => {
    setLoading(true)
    setMessage('')
    setShowResponse(false)

    try {
      // Get random submission
      const response = await fetch('/api/vote/random')

      if (!response.ok) {
        if (response.status === 404) {
          setMessage('no more submissions 2 vote on! check bak later or submit ur own')
          setCurrentSubmission(null)
        } else {
          throw new Error('Failed to fetch submission')
        }
        setLoading(false)
        return
      }

      const data = await response.json()

      // Check if already voted on this one
      if (votedIds.has(data.id)) {
        // Try to get another one
        loadNextSubmission()
        return
      }

      setCurrentSubmission(data)
    } catch (error) {
      console.error('Error loading submission:', error)
      setMessage('error loading submissions, try agen later')
      setCurrentSubmission(null)
    }

    setLoading(false)
  }

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!currentSubmission) return

    try {
      // Get voter IP
      const ipResponse = await fetch('https://api.ipify.org?format=json')
      const { ip } = await ipResponse.json()

      // Cast vote
      const voteResponse = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: currentSubmission.id,
          vote_type: voteType,
          voter_identifier: voterWallet || ip,
          voter_wallet: voterWallet
        })
      })

      const result = await voteResponse.json()

      if (result.success) {
        // Mark as voted
        setVotedIds(prev => new Set(prev).add(currentSubmission.id))

        // Show random response
        const responseText = getVoteResponse()
        setVoteResponseText(responseText)
        setShowResponse(true)

        // Load next submission after brief delay
        setTimeout(() => {
          loadNextSubmission()
        }, 1500)
      } else {
        // Handle already voted or other errors
        if (result.error?.includes('already voted')) {
          setMessage(result.error)
          setVotedIds(prev => new Set(prev).add(currentSubmission.id))
          setTimeout(() => loadNextSubmission(), 2000)
        } else {
          setMessage(result.error || 'vote failed')
        }
      }
    } catch (error) {
      console.error('Error voting:', error)
      setMessage('error casting vote')
    }
  }

  const handleSkip = () => {
    // Mark as seen (not voted, but don't show again)
    if (currentSubmission) {
      setVotedIds(prev => new Set(prev).add(currentSubmission.id))
    }
    loadNextSubmission()
  }

  if (loading && !currentSubmission) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
          <h2 style={{ fontSize: '36px', marginBottom: '20px' }}>
            loading savant submissions...
          </h2>
          <div style={{ fontSize: '48px' }}>⏳</div>
        </div>
      </div>
    )
  }

  if (message && !currentSubmission) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
          <h2 style={{ fontSize: '36px', marginBottom: '20px' }}>
            {message}
          </h2>
          <button
            onClick={() => window.location.href = '/site/submit'}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '24px',
              padding: '15px 30px',
              background: '#ff00ff',
              border: '4px solid #000',
              cursor: 'pointer',
              boxShadow: '5px 5px 0 #000',
              marginTop: '20px'
            }}
          >
            submit ur own
          </button>
        </div>
      </div>
    )
  }

  if (!currentSubmission) {
    return null
  }

  return (
    <div className="page active">
      {/* Title */}
      <div style={{
        textAlign: 'center',
        padding: '15px 20px 0',
      }}>
        <h1 style={{
          fontSize: '48px',
          color: '#fff',
          textShadow: '3px 3px 0 #000',
          marginBottom: '5px'
        }}>
          aprove r denie
        </h1>
        <p style={{
          fontSize: '20px',
          color: '#fff',
          textShadow: '2px 2px 0 #000',
          marginBottom: '10px'
        }}>
          help us find da best savants
        </p>
      </div>

      {/* Vote response overlay */}
      {showResponse && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.9)',
          padding: '40px 60px',
          border: '5px solid #fff',
          borderRadius: '10px',
          zIndex: 1000,
          fontSize: '32px',
          color: '#fff',
          textShadow: '2px 2px 0 #000',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-in'
        }}>
          {voteResponseText}
        </div>
      )}

      {/* Voting card */}
      <VotingCard
        submission={currentSubmission}
        onVote={handleVote}
        onSkip={handleSkip}
        loading={loading}
      />

      {/* Vote count */}
      <div style={{
        textAlign: 'center',
        marginTop: '20px',
        fontSize: '18px',
        color: '#fff',
        textShadow: '2px 2px 0 #000',
      }}>
        u voted on {votedIds.size} submission{votedIds.size !== 1 ? 's' : ''}
      </div>

      {/* Error message */}
      {message && (
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          padding: '15px',
          background: 'rgba(255, 0, 0, 0.8)',
          border: '3px solid #000',
          color: '#fff',
          fontSize: '18px',
          maxWidth: '600px',
          margin: '20px auto'
        }}>
          {message}
        </div>
      )}
    </div>
  )
}
