'use client'

import { useState, useEffect } from 'react'
import { truncateAddress } from '@/lib/utils'

type Tab = 'submissions' | 'voters'

type Submission = {
  rank: number
  wallet_address: string
  name: string
  info: string
  score: number
  whitelist_status: string | null
}

type Voter = {
  rank: number
  wallet_address: string
  karma_score: number
  votes_cast: number
  weighted_votes: number
  whitelist_status: string | null
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('submissions')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [voters, setVoters] = useState<Voter[]>([])
  const [loading, setLoading] = useState(true)
  const [searchWallet, setSearchWallet] = useState('')
  const [searchResult, setSearchResult] = useState<Submission | Voter | null>(null)

  useEffect(() => {
    loadData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [tab])

  const loadData = async () => {
    setLoading(true)

    if (tab === 'submissions') {
      try {
        const response = await fetch('/api/leaderboard/submissions')
        if (response.ok) {
          const data = await response.json()
          setSubmissions(data)
        }
      } catch (error) {
        console.error('Error loading submissions:', error)
      }
    } else {
      try {
        const response = await fetch('/api/leaderboard/voters')
        if (response.ok) {
          const data = await response.json()
          setVoters(data)
        }
      } catch (error) {
        console.error('Error loading voters:', error)
      }
    }

    setLoading(false)
  }

  const handleSearch = async () => {
    if (!searchWallet.trim()) return

    try {
      if (tab === 'submissions') {
        const response = await fetch(`/api/profile/${searchWallet}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResult(data)
        } else {
          setSearchResult(null)
          alert('wallet not found')
        }
      } else {
        // Search in voters list
        const found = voters.find(v => v.wallet_address.toLowerCase() === searchWallet.toLowerCase())
        if (found) {
          setSearchResult(found)
        } else {
          setSearchResult(null)
          alert('wallet not found in voters')
        }
      }
    } catch (error) {
      console.error('Search error:', error)
    }
  }

  const getPodiumColor = (rank: number): string => {
    if (rank === 1) return '#ffd700' // Gold
    if (rank === 2) return '#c0c0c0' // Silver
    if (rank === 3) return '#cd7f32' // Bronze
    return '#fff'
  }

  const renderSubmissionsPodium = () => {
    const topThree = submissions.slice(0, 3)

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: '20px',
        marginBottom: '40px',
        padding: '20px'
      }}>
        {/* 2nd place */}
        {topThree[1] && (
          <div style={{
            textAlign: 'center',
            order: 1
          }}>
            <div style={{
              background: getPodiumColor(2),
              border: '5px solid #000',
              padding: '20px',
              boxShadow: '8px 8px 0 #000',
              minWidth: '200px',
              height: '200px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '48px' }}>🥈</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
                {topThree[1].name}
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff00ff', textShadow: '2px 2px 0 #000' }}>
                {topThree[1].score}
              </div>
            </div>
          </div>
        )}

        {/* 1st place - tallest */}
        {topThree[0] && (
          <div style={{
            textAlign: 'center',
            order: 2
          }}>
            <div style={{
              background: getPodiumColor(1),
              border: '5px solid #000',
              padding: '20px',
              boxShadow: '10px 10px 0 #000',
              minWidth: '220px',
              height: '280px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '64px' }}>👑</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#000' }}>
                {topThree[0].name}
              </div>
              <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#ff00ff', textShadow: '3px 3px 0 #000' }}>
                {topThree[0].score}
              </div>
            </div>
          </div>
        )}

        {/* 3rd place */}
        {topThree[2] && (
          <div style={{
            textAlign: 'center',
            order: 3
          }}>
            <div style={{
              background: getPodiumColor(3),
              border: '5px solid #000',
              padding: '20px',
              boxShadow: '7px 7px 0 #000',
              minWidth: '180px',
              height: '160px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '42px' }}>🥉</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
                {topThree[2].name}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff00ff', textShadow: '2px 2px 0 #000' }}>
                {topThree[2].score}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderSubmissionsList = () => {
    const remaining = submissions.slice(3)

    return remaining.map((sub) => (
      <div
        key={sub.wallet_address}
        className="leaderboard-entry"
        style={{
          background: sub.whitelist_status === 'approved' ? '#d4edda' : '#fff',
        }}
      >
        <div className="leaderboard-rank">#{sub.rank}</div>
        <div className="leaderboard-content">
          <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>
            {sub.name}
          </div>
          <div style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
            {sub.info.length > 100 ? sub.info.substring(0, 100) + '...' : sub.info}
          </div>
          <div style={{ fontSize: '14px', color: '#999', fontFamily: 'monospace' }}>
            {truncateAddress(sub.wallet_address)}
          </div>
        </div>
        <div className="leaderboard-score">{sub.score}</div>
      </div>
    ))
  }

  const renderVotersPodium = () => {
    const topThree = voters.slice(0, 3)

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: '20px',
        marginBottom: '40px',
        padding: '20px'
      }}>
        {/* 2nd place */}
        {topThree[1] && (
          <div style={{
            textAlign: 'center',
            order: 1
          }}>
            <div style={{
              background: getPodiumColor(2),
              border: '5px solid #000',
              padding: '20px',
              boxShadow: '8px 8px 0 #000',
              minWidth: '200px',
              height: '200px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '48px' }}>🥈</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace' }}>
                {truncateAddress(topThree[1].wallet_address)}
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#00ff00', textShadow: '2px 2px 0 #000' }}>
                {topThree[1].karma_score}
              </div>
            </div>
          </div>
        )}

        {/* 1st place */}
        {topThree[0] && (
          <div style={{
            textAlign: 'center',
            order: 2
          }}>
            <div style={{
              background: getPodiumColor(1),
              border: '5px solid #000',
              padding: '20px',
              boxShadow: '10px 10px 0 #000',
              minWidth: '220px',
              height: '280px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '64px' }}>👑</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace' }}>
                {truncateAddress(topThree[0].wallet_address)}
              </div>
              <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#00ff00', textShadow: '3px 3px 0 #000' }}>
                {topThree[0].karma_score}
              </div>
            </div>
          </div>
        )}

        {/* 3rd place */}
        {topThree[2] && (
          <div style={{
            textAlign: 'center',
            order: 3
          }}>
            <div style={{
              background: getPodiumColor(3),
              border: '5px solid #000',
              padding: '20px',
              boxShadow: '7px 7px 0 #000',
              minWidth: '180px',
              height: '160px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '42px' }}>🥉</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#000', fontFamily: 'monospace' }}>
                {truncateAddress(topThree[2].wallet_address)}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#00ff00', textShadow: '2px 2px 0 #000' }}>
                {topThree[2].karma_score}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderVotersList = () => {
    const remaining = voters.slice(3)

    return remaining.map((voter) => (
      <div
        key={voter.wallet_address}
        className="leaderboard-entry"
        style={{
          background: voter.whitelist_status === 'approved' ? '#d4edda' : '#fff',
        }}
      >
        <div className="leaderboard-rank">#{voter.rank}</div>
        <div className="leaderboard-content">
          <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '5px' }}>
            {truncateAddress(voter.wallet_address)}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {voter.votes_cast} votes cast · {voter.weighted_votes.toFixed(2)} weighted
          </div>
        </div>
        <div className="leaderboard-score" style={{ color: '#00ff00' }}>{voter.karma_score}</div>
      </div>
    ))
  }

  return (
    <div className="page active">
      <div className="leaderboard-container">
        {/* Title */}
        <h1 style={{
          fontSize: '56px',
          textAlign: 'center',
          color: '#fff',
          textShadow: '4px 4px 0 #000',
          marginBottom: '10px'
        }}>
          leederbord
        </h1>
        <p style={{
          fontSize: '20px',
          textAlign: 'center',
          color: '#fff',
          textShadow: '2px 2px 0 #000',
          marginBottom: '30px'
        }}>
          who da best savants?
        </p>

        {/* Tabs */}
        <div className="leaderboard-tabs">
          <button
            className={`leaderboard-tab ${tab === 'submissions' ? 'active' : ''}`}
            onClick={() => setTab('submissions')}
          >
            best submishuns
          </button>
          <button
            className={`leaderboard-tab ${tab === 'voters' ? 'active' : ''}`}
            onClick={() => setTab('voters')}
          >
            best voters
          </button>
        </div>

        {/* Search */}
        <div style={{
          maxWidth: '600px',
          margin: '0 auto 30px',
          display: 'flex',
          gap: '10px'
        }}>
          <input
            type="text"
            value={searchWallet}
            onChange={(e) => setSearchWallet(e.target.value)}
            placeholder="search by wallet address..."
            style={{
              flex: 1,
              fontFamily: 'Comic Neue, cursive',
              fontSize: '18px',
              padding: '12px',
              border: '3px solid #000',
              background: '#fff'
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '18px',
              padding: '12px 24px',
              background: '#ffff00',
              border: '3px solid #000',
              cursor: 'pointer',
              boxShadow: '3px 3px 0 #000'
            }}
          >
            search
          </button>
        </div>

        {/* Search result */}
        {searchResult && (
          <div style={{
            maxWidth: '800px',
            margin: '0 auto 30px',
            padding: '20px',
            background: '#d4edda',
            border: '5px solid #000',
            boxShadow: '8px 8px 0 #000'
          }}>
            <h3 style={{ marginBottom: '10px' }}>Search Result:</h3>
            {tab === 'submissions' && 'info' in searchResult && (
              <>
                <div><strong>Name:</strong> {searchResult.name}</div>
                <div><strong>Rank:</strong> #{searchResult.rank}</div>
                <div><strong>Score:</strong> {searchResult.score}</div>
                <div><strong>Info:</strong> {searchResult.info}</div>
              </>
            )}
            {tab === 'voters' && 'votes_cast' in searchResult && (
              <>
                <div><strong>Rank:</strong> #{searchResult.rank}</div>
                <div><strong>Karma:</strong> {searchResult.karma_score}</div>
                <div><strong>Votes Cast:</strong> {searchResult.votes_cast}</div>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', fontSize: '36px', padding: '50px' }}>
            loading...
          </div>
        ) : (
          <>
            {/* Podium */}
            {tab === 'submissions' && submissions.length >= 3 && renderSubmissionsPodium()}
            {tab === 'voters' && voters.length >= 3 && renderVotersPodium()}

            {/* List */}
            {tab === 'submissions' && renderSubmissionsList()}
            {tab === 'voters' && renderVotersList()}
          </>
        )}
      </div>
    </div>
  )
}
