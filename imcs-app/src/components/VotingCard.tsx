'use client'

import { useState } from 'react'
import { truncateAddress } from '@/lib/utils'

type Submission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
}

type VotingCardProps = {
  submission: Submission
  onVote: (voteType: 'upvote' | 'downvote') => void
  onSkip: () => void
  loading?: boolean
}

export default function VotingCard({ submission, onVote, onSkip, loading }: VotingCardProps) {
  const [voting, setVoting] = useState(false)
  const [voteType, setVoteType] = useState<'upvote' | 'downvote' | null>(null)

  const handleVote = async (type: 'upvote' | 'downvote') => {
    setVoting(true)
    setVoteType(type)
    await onVote(type)
    setVoting(false)
  }

  return (
    <div className="voting-card-wrapper">
      <div className="voting-card" style={{
        transform: `rotate(${Math.random() * 4 - 2}deg)`,
        background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
        border: '5px solid #000',
        padding: '40px',
        boxShadow: '10px 10px 0 #000',
        maxWidth: '600px',
        margin: '50px auto',
        position: 'relative'
      }}>
        {/* Submission text */}
        <div style={{
          fontSize: '24px',
          lineHeight: '1.4',
          marginBottom: '25px',
          color: '#fff',
          textShadow: '2px 2px 0 #000',
          minHeight: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          "{submission.info}"
        </div>

        {/* Wallet address */}
        <div style={{
          fontSize: '16px',
          color: '#000',
          fontFamily: 'monospace',
          textAlign: 'center',
          marginBottom: '30px',
          background: 'rgba(255, 255, 255, 0.7)',
          padding: '8px',
          borderRadius: '4px',
          border: '2px solid #000'
        }}>
          - {truncateAddress(submission.wallet_address)}
        </div>

        {/* Vote buttons */}
        <div style={{
          display: 'flex',
          gap: '20px',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => handleVote('upvote')}
            disabled={voting || loading}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '48px',
              padding: '15px 30px',
              background: '#00ff00',
              border: '4px solid #000',
              cursor: voting || loading ? 'wait' : 'pointer',
              boxShadow: '5px 5px 0 #000',
              transition: 'all 0.1s',
              opacity: voting && voteType !== 'upvote' ? 0.5 : 1,
              transform: voting && voteType === 'upvote' ? 'scale(1.1)' : 'scale(1)'
            }}
            onMouseDown={(e) => {
              if (!voting && !loading) {
                e.currentTarget.style.transform = 'scale(0.95)'
                e.currentTarget.style.boxShadow = '2px 2px 0 #000'
              }
            }}
            onMouseUp={(e) => {
              if (!voting && !loading) {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '5px 5px 0 #000'
              }
            }}
          >
            👍
          </button>

          <button
            onClick={() => handleVote('downvote')}
            disabled={voting || loading}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '48px',
              padding: '15px 30px',
              background: '#ff0000',
              border: '4px solid #000',
              cursor: voting || loading ? 'wait' : 'pointer',
              boxShadow: '5px 5px 0 #000',
              transition: 'all 0.1s',
              opacity: voting && voteType !== 'downvote' ? 0.5 : 1,
              transform: voting && voteType === 'downvote' ? 'scale(1.1)' : 'scale(1)'
            }}
            onMouseDown={(e) => {
              if (!voting && !loading) {
                e.currentTarget.style.transform = 'scale(0.95)'
                e.currentTarget.style.boxShadow = '2px 2px 0 #000'
              }
            }}
            onMouseUp={(e) => {
              if (!voting && !loading) {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '5px 5px 0 #000'
              }
            }}
          >
            👎
          </button>
        </div>

        {/* Skip button */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={onSkip}
            disabled={voting || loading}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '18px',
              padding: '10px 20px',
              background: '#ccc',
              border: '3px solid #000',
              cursor: voting || loading ? 'wait' : 'pointer',
              boxShadow: '3px 3px 0 #000'
            }}
          >
            skip dis one
          </button>
        </div>
      </div>
    </div>
  )
}
