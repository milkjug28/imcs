'use client'

import { useState, useEffect, useRef } from 'react'
import VotingCard from '@/components/VotingCard'
import { getVoteResponse } from '@/lib/utils'
import { useWallet } from '@/hooks/useWallet'
import ConnectWallet from '@/components/ConnectWallet'

type Submission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
  rank: number
}

export default function VotePage() {
  const { address: walletAddress, isConnected } = useWallet()
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [showResponse, setShowResponse] = useState(false)
  const [voteResponseText, setVoteResponseText] = useState('')
  const [voteCount, setVoteCount] = useState(0)
  const [totalVoteCount, setTotalVoteCount] = useState(0) // Track total from DB
  const [showMilestone, setShowMilestone] = useState(false)
  const [milestonePoints, setMilestonePoints] = useState(0)
  const [animationInterval] = useState(() => 5 + Math.floor(Math.random() * 3))
  const isLoadingRef = useRef(false)
  const lastMilestoneRef = useRef(0) // Track last milestone achieved

  // Hydrate localStorage-cached voted IDs on mount (cheap, client-only)
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
  }, [])

  // Load first submission once wallet is connected.
  // Keyed on walletAddress so switching wallets reloads with correct filter.
  useEffect(() => {
    if (!walletAddress) {
      setLoading(false)
      return
    }
    loadNextSubmission()
    // loadNextSubmission reads votedIds/walletAddress from closure; we only
    // want this effect to fire on wallet connect, not on every vote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress])

  // Load existing vote count from task completions
  useEffect(() => {
    if (walletAddress) {
      fetch(`/api/tasks/${walletAddress}`)
        .then(res => res.json())
        .then(data => {
          const voteTask = data.tasks?.find((t: any) => t.task_type === 'vote')
          if (voteTask) {
            // Calculate how many 10-vote milestones achieved (score / 100)
            const milestonesAchieved = Math.floor((voteTask.score || 0) / 100)
            lastMilestoneRef.current = milestonesAchieved
            setTotalVoteCount(milestonesAchieved * 10)
          }
        })
        .catch(e => console.error('Failed to fetch vote task:', e))
    }
  }, [walletAddress])

  useEffect(() => {
    if (votedIds.size > 0) {
      localStorage.setItem('votedSubmissions', JSON.stringify(Array.from(votedIds)))
    }
  }, [votedIds])

  const loadNextSubmission = async (additionalExcludeIds?: Set<string>) => {
    if (!walletAddress) return
    // Prevent concurrent loads
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    setLoading(true)
    setMessage('')
    setShowResponse(false)

    try {
      // Combine votedIds with any additional excludes
      const allExcludeIds = new Set([...votedIds, ...(additionalExcludeIds || [])])

      // Build URL with exclude IDs and wallet as voter identifier
      const params = new URLSearchParams()
      if (allExcludeIds.size > 0) {
        params.set('exclude', Array.from(allExcludeIds).join(','))
      }
      params.set('voter', walletAddress)

      const url = `/api/vote/random?${params.toString()}`
      const response = await fetch(url, { cache: 'no-store' })

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

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!currentSubmission || !walletAddress) return

    const submissionId = currentSubmission.id

    // Mark as voted
    const newVotedIds = new Set(votedIds)
    newVotedIds.add(submissionId)
    setVotedIds(newVotedIds)

    const newVoteCount = voteCount + 1
    setVoteCount(newVoteCount)

    // Fire vote API in background (wallet-authenticated only)
    fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submissionId,
        vote_type: voteType,
        voter_identifier: walletAddress,
        voter_wallet: walletAddress
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            console.error('Vote API error:', res.status, data)
          })
        }
      })
      .catch(err => console.error('Vote network error:', err))

    // Check for 10-vote milestone (every 10 votes in this session)
    const totalVotes = totalVoteCount + newVoteCount
    const currentMilestone = Math.floor(totalVotes / 10)

    if (currentMilestone > lastMilestoneRef.current) {
      // New milestone reached! Award 100 points
      lastMilestoneRef.current = currentMilestone
      setMilestonePoints(100)
      setShowMilestone(true)

      // Save to task completions (adds 100 points per milestone)
      try {
        await fetch('/api/tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: walletAddress,
            task_type: 'vote',
            score: 100,
          })
        })
      } catch (e) {
        console.error('Failed to save vote milestone:', e)
      }

      // Hide milestone after 2.5 seconds
      setTimeout(() => {
        setShowMilestone(false)
        loadNextSubmission(newVotedIds)
      }, 2500)
    } else if (newVoteCount % animationInterval === 0) {
      // Show regular response overlay every 5-7 votes
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

  // Wallet connection gate
  if (!isConnected) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 className="form-title">aprove r denie</h2>
          <p style={{ fontSize: '20px', marginBottom: '15px' }}>
            connect ur wallut 2 vote on savant submishuns
          </p>
          <p style={{ fontSize: '14px', marginBottom: '30px', opacity: 0.8 }}>
            every 10 votes = 100 points toward savant whitelist
          </p>
          <ConnectWallet label="connect wallut" />
        </div>
      </div>
    )
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
            onClick={() => window.location.href = '/sitee/submit'}
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

      {/* Milestone celebration overlay */}
      {showMilestone && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
        }}>
          <div style={{
            fontSize: 'clamp(48px, 15vw, 80px)',
            marginBottom: '20px',
          }}>
            🎉
          </div>
          <div style={{
            fontSize: 'clamp(28px, 8vw, 48px)',
            color: '#00ff00',
            textShadow: '3px 3px 0 #000',
            marginBottom: '15px',
            textAlign: 'center',
          }}>
            10 VOTES MILESTONE!
          </div>
          <div style={{
            fontSize: 'clamp(36px, 10vw, 64px)',
            color: '#ffff00',
            textShadow: '3px 3px 0 #000',
            fontWeight: 'bold',
          }}>
            +{milestonePoints} points!
          </div>
          <div style={{
            fontSize: '18px',
            color: '#fff',
            marginTop: '20px',
          }}>
            keep voting 4 more points!
          </div>
        </div>
      )}

      {/* Vote response overlay */}
      {showResponse && !showMilestone && (
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
