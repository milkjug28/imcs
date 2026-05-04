'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { truncateAddress } from '@/lib/utils'

type Submission = {
  wallet_address: string
  name: string
  info: string
  score: number
  submission_score?: number
  whitelist_status: string | null
}

const getMedalEmoji = (rank: number) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

const getRandomRotation = (i: number) => {
  const rotations = [-2, 1.5, -1, 2, -1.5, 0.5, -0.5]
  return rotations[i % rotations.length]
}

const getRandomGradient = (i: number) => {
  const gradients = [
    'linear-gradient(135deg, #ff6b9d, #ffd700)',
    'linear-gradient(135deg, #00ff87, #60efff)',
    'linear-gradient(135deg, #ff00ff, #00bfff)',
    'linear-gradient(135deg, #ffd700, #ff6347)',
    'linear-gradient(135deg, #7b68ee, #ff6b9d)',
    'linear-gradient(135deg, #00ffff, #ff00ff)',
    'linear-gradient(135deg, #ffff00, #00ff00)',
  ]
  return gradients[i % gradients.length]
}

const getGlowColor = (rank: number) => {
  if (rank === 1) return '#ffd700' // Gold
  if (rank === 2) return '#c0c0c0' // Silver
  if (rank === 3) return '#cd7f32' // Bronze
  return null
}

export default function LeaderboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchWallet, setSearchWallet] = useState('')
  const [searchResult, setSearchResult] = useState<Submission | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/leaderboard/submissions?limit=100&include=info')
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data)
      } else {
        const errorData = await response.json()
        console.error('Leaderboard API error:', errorData)
      }
    } catch (error) {
      console.error('Error loading submissions:', error)
    }

    setLoading(false)
  }

  const handleSearch = async () => {
    if (!searchWallet.trim()) return

    try {
      const response = await fetch(`/api/profile/${searchWallet}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResult(data)
      } else {
        setSearchResult(null)
        alert('wallet not found')
      }
    } catch (error) {
      console.error('Search error:', error)
    }
  }

  return (
    <div className="page active">
      <div style={{ maxWidth: '750px', margin: '0 auto', padding: '0 15px' }}>
        {/* Title - chaotic */}
        <motion.h1
          animate={{ rotate: [0, -1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: 'clamp(28px, 8vw, 46px)',
            textAlign: 'center',
            color: '#000',
            textShadow: '2px 2px 0 #ff00ff',
            marginBottom: '5px',
            fontFamily: 'Comic Neue, cursive',
            fontWeight: 700
          }}
        >
          leederbord
        </motion.h1>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{
            fontSize: 'clamp(16px, 4vw, 18px)',
            color: '#000',
            fontFamily: 'Comic Neue, cursive',
            fontWeight: 700,
            background: '#ffff00',
            padding: '4px 12px',
            display: 'inline-block',
            border: '2px solid #000'
          }}>
            tahp 100 savaants
          </span>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', transform: 'rotate(-0.5deg)' }}>
          <input
            type="text"
            value={searchWallet}
            onChange={(e) => setSearchWallet(e.target.value)}
            placeholder="search wallet..."
            style={{
              flex: 1,
              fontFamily: 'Comic Neue, cursive',
              fontSize: '15px',
              padding: '10px 14px',
              border: '3px solid #000',
              background: '#fff',
              boxShadow: '3px 3px 0 #000'
            }}
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9, rotate: 10 }}
            onClick={handleSearch}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '15px',
              padding: '10px 18px',
              background: '#ffff00',
              border: '3px solid #000',
              cursor: 'pointer',
              boxShadow: '3px 3px 0 #000',
              fontWeight: 'bold'
            }}
          >
            go!
          </motion.button>
        </div>

        {/* Search result */}
        {searchResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              marginBottom: '25px',
              padding: '15px',
              background: 'linear-gradient(135deg, #d4edda, #c3e6cb)',
              border: '3px solid #000',
              boxShadow: '5px 5px 0 #000',
              transform: 'rotate(0.5deg)'
            }}
          >
            <h3 style={{ marginBottom: '8px', fontFamily: 'Comic Neue, cursive' }}>found em!</h3>
            <div style={{ fontFamily: 'Comic Neue, cursive', fontSize: '14px' }}>
              <div><strong>name:</strong> {searchResult.name}</div>
              <div><strong>total points:</strong> {(searchResult as any).total_points ?? searchResult.submission_score ?? searchResult.score}</div>
              <div><strong>info:</strong> {searchResult.info}</div>
            </div>
          </motion.div>
        )}

        {loading ? (
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            style={{ textAlign: 'center', fontSize: '36px', padding: '50px', color: '#fff' }}
          >
            loadin...
          </motion.div>
        ) : (
          /* List - chaos cards */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {submissions.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#fff',
                fontFamily: 'Comic Neue, cursive',
                fontSize: '20px'
              }}>
                no submissions yet... be da first!
              </div>
            )}

            {submissions.map((sub, i) => {
              const rank = i + 1 // Calculate rank from array index
              const glowColor = getGlowColor(rank)
              return (
                <motion.div
                  key={sub.wallet_address}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30, rotate: getRandomRotation(i) * 2 }}
                  animate={{ opacity: 1, x: 0, rotate: getRandomRotation(i) }}
                  transition={{ delay: i * 0.07, type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.02, rotate: 0, zIndex: 10, boxShadow: glowColor ? `0 0 25px ${glowColor}, 5px 5px 0 #000` : '8px 8px 0 #000' }}
                  style={{
                    background: getRandomGradient(i),
                    border: glowColor ? `3px solid ${glowColor}` : '3px solid #000',
                    padding: '12px 16px',
                    boxShadow: glowColor ? `0 0 15px ${glowColor}, 5px 5px 0 #000` : '5px 5px 0 #000',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {/* Medal badge for top 3 */}
                  {getMedalEmoji(rank) && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-8px',
                      fontSize: '28px',
                      transform: 'rotate(15deg)'
                    }}>
                      {getMedalEmoji(rank)}
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ minWidth: '55px', textAlign: 'center' }}>
                      <span style={{
                        fontFamily: 'Comic Neue, cursive',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#000',
                        display: 'block'
                      }}>
                        #{rank}
                      </span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#000'
                      }}>
                        {sub.score} pts
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: 'Comic Neue, cursive',
                          fontSize: '17px',
                          fontWeight: 'bold',
                          color: '#000'
                        }}>
                          {sub.name}
                        </span>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '10px',
                          color: 'rgba(0,0,0,0.6)',
                          background: 'rgba(255,255,255,0.5)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {truncateAddress(sub.wallet_address)}
                        </span>
                      </div>
                      <div style={{
                        fontFamily: 'Comic Neue, cursive',
                        fontSize: '14px',
                        color: '#000',
                        lineHeight: 1.4
                      }}>
                        &quot;{sub.info}&quot;
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
