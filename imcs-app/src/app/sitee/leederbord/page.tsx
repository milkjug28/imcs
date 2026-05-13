'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

type Holder = {
  wallet: string
  count: number
  totalIQ: number
}

type Savant = {
  tokenId: number
  iq: number
  name: string | null
  holder: string
}

type Tab = 'count' | 'iq' | 'savants'

const getMedalEmoji = (rank: number) => {
  if (rank === 1) return '\u{1F947}'
  if (rank === 2) return '\u{1F948}'
  if (rank === 3) return '\u{1F949}'
  return null
}

const getRandomRotation = (i: number) => {
  const rotations = [-1.5, 1, -0.8, 1.5, -1, 0.5, -0.5]
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
  if (rank === 1) return '#ffd700'
  if (rank === 2) return '#c0c0c0'
  if (rank === 3) return '#cd7f32'
  return null
}

const truncate = (w: string) => `${w.slice(0, 6)}...${w.slice(-4)}`

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('count')
  const [holders, setHolders] = useState<Holder[]>([])
  const [savants, setSavants] = useState<Savant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchWallet, setSearchWallet] = useState('')
  const [searchResult, setSearchResult] = useState<Holder | null>(null)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [holdersRes, savantsRes] = await Promise.all([
        fetch('/api/leaderboard/iq?view=holders'),
        fetch('/api/leaderboard/iq?view=savants'),
      ])
      if (holdersRes.ok) {
        const data = await holdersRes.json()
        setHolders(data)
      }
      if (savantsRes.ok) {
        const data = await savantsRes.json()
        setSavants(data)
      }
    } catch {}
    setLoading(false)
  }

  const sortedByCount = [...holders].sort((a, b) => b.count - a.count)
  const sortedByIQ = [...holders].sort((a, b) => b.totalIQ - a.totalIQ)

  const handleSearch = () => {
    if (!searchWallet.trim()) return
    setSearchError('')
    setSearchResult(null)
    const normalized = searchWallet.trim().toLowerCase()
    const found = holders.find(h => h.wallet.toLowerCase() === normalized)
    if (found) {
      setSearchResult(found)
    } else {
      setSearchError('wallet not on leederbord, dork')
    }
  }

  const currentHolders = tab === 'iq' ? sortedByIQ : sortedByCount

  return (
    <div className="page active">
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 15px' }}>
        <motion.h1
          animate={{ rotate: [0, -1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: 'clamp(28px, 8vw, 42px)',
            textAlign: 'center',
            color: '#000',
            textShadow: '2px 2px 0 #ff00ff',
            marginBottom: '5px',
            fontFamily: "'Comic Neue', cursive",
            fontWeight: 700,
          }}
        >
          leederbord
        </motion.h1>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '16px',
          fontFamily: "'Comic Neue', cursive",
          fontSize: '12px',
          fontWeight: 'bold',
          flexWrap: 'wrap',
        }}>
          {([
            { key: 'count' as Tab, label: 'tahp holdurs' },
            { key: 'iq' as Tab, label: 'holdur iq' },
            { key: 'savants' as Tab, label: 'savant iq top 100' },
          ]).map(t => (
            <motion.button
              key={t.key}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab(t.key)}
              style={{
                background: tab === t.key ? '#ffff00' : '#ff69b4',
                padding: '3px 10px',
                border: '2px solid #000',
                color: '#000',
                cursor: 'pointer',
                fontFamily: "'Comic Neue', cursive",
                fontSize: '12px',
                fontWeight: 'bold',
                boxShadow: tab === t.key ? '3px 3px 0 #000' : 'none',
                opacity: tab === t.key ? 1 : 0.7,
              }}
            >
              {t.label}
            </motion.button>
          ))}
        </div>

        {/* Search (holders tabs only) */}
        {tab !== 'savants' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', transform: 'rotate(-0.5deg)' }}>
              <input
                type="text"
                value={searchWallet}
                onChange={e => setSearchWallet(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="search wallet..."
                style={{
                  flex: 1,
                  fontFamily: "'Comic Neue', cursive",
                  fontSize: '14px',
                  padding: '8px 12px',
                  border: '3px solid #000',
                  background: '#fff',
                  boxShadow: '3px 3px 0 #000',
                }}
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9, rotate: 10 }}
                onClick={handleSearch}
                style={{
                  fontFamily: "'Comic Neue', cursive",
                  fontSize: '14px',
                  padding: '8px 16px',
                  background: '#ffff00',
                  border: '3px solid #000',
                  cursor: 'pointer',
                  boxShadow: '3px 3px 0 #000',
                  fontWeight: 'bold',
                }}
              >
                go!
              </motion.button>
            </div>

            {searchResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #d4edda, #c3e6cb)',
                  border: '3px solid #000',
                  boxShadow: '4px 4px 0 #000',
                  fontFamily: "'Comic Neue', cursive",
                  fontSize: '14px',
                }}
              >
                <strong>found!</strong> {truncate(searchResult.wallet)} holds <strong>{searchResult.count}</strong> savant{searchResult.count !== 1 ? 's' : ''} | iq: <strong>{searchResult.totalIQ}</strong> | rank #{
                  (tab === 'iq' ? sortedByIQ : sortedByCount).findIndex(h => h.wallet === searchResult!.wallet) + 1
                }
              </motion.div>
            )}
            {searchError && (
              <div style={{
                marginBottom: '16px',
                padding: '10px',
                background: '#ff4444',
                border: '3px solid #000',
                color: '#fff',
                fontFamily: "'Comic Neue', cursive",
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: '14px',
              }}>
                {searchError}
              </div>
            )}
          </>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
              {['#ff69b4', '#00bfff', '#ffd700'].map((color, i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                  style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, border: '2px solid #000' }}
                />
              ))}
            </div>
            <span style={{ fontFamily: "'Comic Neue', cursive", fontSize: '16px', fontWeight: 'bold' }}>loadin...</span>
          </div>
        ) : tab === 'savants' ? (
          /* Savant IQ Top 100 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {savants.map((savant, i) => {
              const rank = i + 1
              const glowColor = getGlowColor(rank)
              return (
                <motion.div
                  key={savant.tokenId}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -15 : 15 }}
                  animate={{ opacity: 1, x: 0, rotate: getRandomRotation(i) }}
                  transition={{ delay: Math.min(i * 0.03, 1.5), type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.02, rotate: 0, zIndex: 10 }}
                  style={{
                    background: getRandomGradient(i),
                    border: glowColor ? `3px solid ${glowColor}` : '3px solid #000',
                    padding: '8px 12px',
                    boxShadow: glowColor ? `0 0 10px ${glowColor}, 3px 3px 0 #000` : '3px 3px 0 #000',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  {getMedalEmoji(rank) && (
                    <div style={{
                      position: 'absolute',
                      top: '-7px',
                      right: '-5px',
                      fontSize: '20px',
                      transform: 'rotate(15deg)',
                    }}>
                      {getMedalEmoji(rank)}
                    </div>
                  )}

                  <div style={{
                    minWidth: '36px',
                    textAlign: 'center',
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: '#000',
                  }}>
                    #{rank}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "'Comic Neue', cursive",
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#000',
                    }}>
                      {savant.name || `#${savant.tokenId}`}
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      color: 'rgba(0,0,0,0.5)',
                    }}>
                      held by {truncate(savant.holder)}
                    </div>
                  </div>

                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#000',
                    minWidth: '60px',
                    textAlign: 'right',
                  }}>
                    IQ: {savant.iq}
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          /* Holders (count or IQ) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {currentHolders.map((holder, i) => {
              const rank = i + 1
              const glowColor = getGlowColor(rank)
              return (
                <motion.div
                  key={holder.wallet}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -15 : 15 }}
                  animate={{ opacity: 1, x: 0, rotate: getRandomRotation(i) }}
                  transition={{ delay: Math.min(i * 0.03, 1.5), type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.02, rotate: 0, zIndex: 10 }}
                  style={{
                    background: getRandomGradient(i),
                    border: glowColor ? `3px solid ${glowColor}` : '3px solid #000',
                    padding: '8px 12px',
                    boxShadow: glowColor ? `0 0 10px ${glowColor}, 3px 3px 0 #000` : '3px 3px 0 #000',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  {getMedalEmoji(rank) && (
                    <div style={{
                      position: 'absolute',
                      top: '-7px',
                      right: '-5px',
                      fontSize: '20px',
                      transform: 'rotate(15deg)',
                    }}>
                      {getMedalEmoji(rank)}
                    </div>
                  )}

                  <div style={{
                    minWidth: '36px',
                    textAlign: 'center',
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: '#000',
                  }}>
                    #{rank}
                  </div>

                  <div style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: '#000',
                  }}>
                    {truncate(holder.wallet)}
                  </div>

                  <div style={{
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#000',
                    minWidth: '60px',
                    textAlign: 'right',
                  }}>
                    {tab === 'iq' ? `${holder.totalIQ} IQ` : `${holder.count} \u{1F9D9}‍♂️`}
                  </div>

                  {tab === 'count' && (
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      color: '#666',
                      minWidth: '50px',
                      textAlign: 'right',
                    }}>
                      {holder.totalIQ} iq
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
