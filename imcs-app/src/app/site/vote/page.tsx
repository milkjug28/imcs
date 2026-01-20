'use client'

import { useState, useEffect, useRef } from 'react'
import VotingCard from '@/components/VotingCard'
import { getVoteResponse } from '@/lib/utils'

type Submission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
  rank: number
}

export default function VotePage() {
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [voterWallet, setVoterWallet] = useState<string | null>(null)
  const [showResponse, setShowResponse] = useState(false)
  const [voteResponseText, setVoteResponseText] = useState('')
  const [voteCount, setVoteCount] = useState(0)
  const [animationInterval] = useState(() => 5 + Math.floor(Math.random() * 3))
  const cachedIp = useRef<string | null>(null)
  const isLoadingRef = useRef(false)

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

    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => { cachedIp.current = data.ip })
      .catch(() => { cachedIp.current = 'unknown' })

    setVoterWallet(null)
    loadNextSubmission()
  }, [])

  useEffect(() => {
    if (votedIds.size > 0) {
      localStorage.setItem('votedSubmissions', JSON.stringify(Array.from(votedIds)))
    }
  }, [votedIds])

  const loadNextSubmission = async (excludeIds?: Set<string>) => {
    // Prevent concurrent loads
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    setLoading(true)
    setMessage('')
    setShowResponse(false)

    try {
      const response = await fetch('/api/vote/random')

      if (!response.ok) {
        if (response.status === 404) {
          setMessage('no more submissions 2 vote on! check bak later or submit ur own')
          setCurrentSubmission(null)
        } else {
          throw new Error('Failed to fetch submission')
        }
        setLoading(false)
        isLoadingRef.current = false
        return
      }

      const data = await response.json()
      const idsToCheck = excludeIds || votedIds

      // If already voted, try again (max 3 attempts)
      if (idsToCheck.has(data.id)) {
        isLoadingRef.current = false
        // Add to exclude list and try again
        const newExclude = new Set(idsToCheck)
        newExclude.add(data.id)
        if (newExclude.size < idsToCheck.size + 5) {
          loadNextSubmission(newExclude)
          return
        } else {
          setMessage('no more submissions 2 vote on! check bak later or submit ur own')
          setCurrentSubmission(null)
          setLoading(false)
          return
        }
      }

      setCurrentSubmission(data)
      setLoading(false)
      isLoadingRef.current = false
    } catch (error) {
      console.error('Error loading submission:', error)
      setMessage('error loading submissions, try agen later')
      setCurrentSubmission(null)
      setLoading(false)
      isLoadingRef.current = false
    }
  }

  const handleVote = (voteType: 'upvote' | 'downvote') => {
    if (!currentSubmission) return

    const submissionId = currentSubmission.id

    // Mark as voted
    const newVotedIds = new Set(votedIds)
    newVotedIds.add(submissionId)
    setVotedIds(newVotedIds)

    const newVoteCount = voteCount + 1
    setVoteCount(newVoteCount)

    // Fire vote API in background
    const ip = cachedIp.current || 'unknown'
    fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submissionId,
        vote_type: voteType,
        voter_identifier: voterWallet || ip,
        voter_wallet: voterWallet
      })
    }).catch(err => console.error('Vote error:', err))

    // Show response overlay every 5-7 votes
    if (newVoteCount % animationInterval === 0) {
      const responseText = getVoteResponse()
      setVoteResponseText(responseText)
      setShowResponse(true)
      setTimeout(() => {
        loadNextSubmission(newVotedIds)
      }, 1000)
    } else {
      // Load next immediately
      loadNextSubmission(newVotedIds)
    }
  }

  const handleSkip = () => {
    if (currentSubmission) {
      const newVotedIds = new Set(votedIds)
      newVotedIds.add(currentSubmission.id)
      setVotedIds(newVotedIds)
      loadNextSubmission(newVotedIds)
    }
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
        padding: '15px 15px 0',
      }}>
        <h1 style={{
          fontSize: 'clamp(26px, 8vw, 48px)',
          color: '#000',
          textShadow: '2px 2px 0 #ff00ff',
          marginBottom: '8px',
          fontWeight: 700
        }}>
          aprove r denie
        </h1>
        <p style={{
          fontSize: 'clamp(14px, 4vw, 18px)',
          color: '#000',
          fontWeight: 700,
          marginBottom: '10px',
          background: '#00ff00',
          padding: '4px 12px',
          display: 'inline-block',
          border: '2px solid #000'
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
          textAlign: 'center'
        }}>
          {voteResponseText}
        </div>
      )}

      {/* Voting card */}
      <VotingCard
        key={currentSubmission.id}
        submission={currentSubmission}
        onVote={handleVote}
        onSkip={handleSkip}
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
