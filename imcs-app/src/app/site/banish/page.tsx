'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@/hooks/useWallet'
import { isValidAddress, truncateAddress } from '@/lib/utils'
import ConnectWallet from '@/components/ConnectWallet'

type BanishEntry = {
  target_x_handle: string
  submission_count: number
  target_wallets: string[]
  sample_reasons: string[]
  first_submitted_at: string
}

const getRandomRotation = (i: number) => {
  const rotations = [-2, 1.5, -1, 2, -1.5, 0.5, -0.5]
  return rotations[i % rotations.length]
}

const getRandomGradient = (i: number) => {
  const gradients = [
    'linear-gradient(135deg, #ff4444, #ff6b6b)',
    'linear-gradient(135deg, #8b0000, #dc143c)',
    'linear-gradient(135deg, #ff0000, #ffa500)',
    'linear-gradient(135deg, #cc0000, #ff4466)',
    'linear-gradient(135deg, #b22222, #ff6347)',
    'linear-gradient(135deg, #ff1493, #ff4500)',
    'linear-gradient(135deg, #dc143c, #ffd700)',
  ]
  return gradients[i % gradients.length]
}

const getBanishResponse = () => {
  const responses = [
    'banished! 🔨',
    'BEGONE 🚫',
    'they r done 4',
    'added 2 da wall of shame',
    'rekt lol',
    'community has spoken',
    'banish hammer dropped 🔨💥',
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

export default function BanishPage() {
  const { address, isConnected } = useWallet()
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'submit'>('leaderboard')
  const [leaderboard, setLeaderboard] = useState<BanishEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsSuccess, setMessageIsSuccess] = useState(false)
  const [formData, setFormData] = useState({
    target_x_handle: '',
    target_wallet_address: '',
    reason: '',
  })

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/banish/leaderboard?limit=100')
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data)
      } else {
        console.error('Banish leaderboard error')
      }
    } catch (error) {
      console.error('Error loading banish leaderboard:', error)
    }
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!address) {
      setMessage('connect ur wallut first dummie')
      setMessageIsSuccess(false)
      return
    }
    if (!formData.target_x_handle.trim()) {
      setMessage('who u banishin dummie?')
      setMessageIsSuccess(false)
      return
    }
    if (formData.reason.trim().length < 5) {
      setMessage('give a real reason (5+ chars)')
      setMessageIsSuccess(false)
      return
    }
    if (formData.target_wallet_address.trim() && !isValidAddress(formData.target_wallet_address.trim())) {
      setMessage('thats not a valid wallet address')
      setMessageIsSuccess(false)
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      const response = await fetch('/api/banish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_x_handle: formData.target_x_handle,
          target_wallet_address: formData.target_wallet_address.trim() || undefined,
          reason: formData.reason,
          submitter_wallet: address,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(`${getBanishResponse()} ${data.total_submissions} total report${data.total_submissions === 1 ? '' : 's'} on @${data.banishment.target_x_handle}`)
        setMessageIsSuccess(true)
        setFormData({ target_x_handle: '', target_wallet_address: '', reason: '' })
        loadLeaderboard()
      } else {
        setMessage(data.error || 'banish failed')
        setMessageIsSuccess(false)
      }
    } catch {
      setMessage('sumthin went wrong, try agen')
      setMessageIsSuccess(false)
    }
    setSubmitting(false)
  }

  return (
    <div className="page active">
      <div style={{ maxWidth: '750px', margin: '0 auto', padding: '0 15px' }}>
        {/* Title */}
        <motion.h1
          animate={{ rotate: [0, -1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: 'clamp(28px, 8vw, 46px)',
            textAlign: 'center',
            color: '#000',
            textShadow: '2px 2px 0 #ff0000',
            marginBottom: '5px',
            fontFamily: 'Comic Neue, cursive',
            fontWeight: 700,
          }}
        >
          banisht lewserz
        </motion.h1>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            fontFamily: 'Comic Neue, cursive',
            fontWeight: 700,
            background: '#ff4444',
            color: '#fff',
            padding: '4px 12px',
            display: 'inline-block',
            border: '2px solid #000',
          }}>
            submit x handles 2 banish from savant wurld
          </span>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('leaderboard')}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '16px',
              fontWeight: 'bold',
              padding: '10px 20px',
              background: activeTab === 'leaderboard' ? '#ff0000' : '#fff',
              color: activeTab === 'leaderboard' ? '#fff' : '#000',
              border: '3px solid #000',
              cursor: 'pointer',
              boxShadow: '3px 3px 0 #000',
              transform: 'rotate(-1deg)',
            }}
          >
            wall of shame
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('submit')}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '16px',
              fontWeight: 'bold',
              padding: '10px 20px',
              background: activeTab === 'submit' ? '#ff0000' : '#fff',
              color: activeTab === 'submit' ? '#fff' : '#000',
              border: '3px solid #000',
              cursor: 'pointer',
              boxShadow: '3px 3px 0 #000',
              transform: 'rotate(1deg)',
            }}
          >
            banish sum1
          </motion.button>
        </div>

        {/* Submit Tab */}
        {activeTab === 'submit' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: '30px' }}
          >
            {!isConnected ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'linear-gradient(135deg, #8b0000, #dc143c)',
                border: '3px solid #000',
                boxShadow: '5px 5px 0 #000',
                transform: 'rotate(-0.5deg)',
              }}>
                <h2 style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '24px',
                  color: '#fff',
                  marginBottom: '15px',
                }}>
                  connect wallut 2 banish
                </h2>
                <p style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '16px',
                  color: '#ffcccc',
                  marginBottom: '20px',
                }}>
                  u need a wallut 2 cast banishments
                </p>
                <ConnectWallet label="connect wallut" />
              </div>
            ) : (
              <div style={{
                padding: '20px',
                background: 'linear-gradient(135deg, #1a0000, #330000)',
                border: '3px solid #ff0000',
                boxShadow: '5px 5px 0 #000',
                transform: 'rotate(-0.5deg)',
              }}>
                <h3 style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '20px',
                  color: '#ff4444',
                  marginBottom: '15px',
                  textAlign: 'center',
                }}>
                  who deserves banishment?
                </h3>

                {/* X Handle */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '14px',
                    color: '#ff6b6b',
                    display: 'block',
                    marginBottom: '4px',
                  }}>
                    x handle (required)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'Comic Neue, cursive',
                      fontSize: '18px',
                      color: '#ff4444',
                      padding: '10px 8px 10px 14px',
                      background: '#220000',
                      border: '3px solid #ff0000',
                      borderRight: 'none',
                    }}>@</span>
                    <input
                      type="text"
                      value={formData.target_x_handle}
                      onChange={(e) => setFormData({ ...formData, target_x_handle: e.target.value })}
                      placeholder="elonmusk"
                      maxLength={15}
                      style={{
                        flex: 1,
                        fontFamily: 'Comic Neue, cursive',
                        fontSize: '16px',
                        padding: '10px 14px',
                        border: '3px solid #ff0000',
                        background: '#220000',
                        color: '#fff',
                        boxShadow: '3px 3px 0 #000',
                      }}
                    />
                  </div>
                </div>

                {/* Wallet Address */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '14px',
                    color: '#ff6b6b',
                    display: 'block',
                    marginBottom: '4px',
                  }}>
                    their wallet address (optional but preferred)
                  </label>
                  <input
                    type="text"
                    value={formData.target_wallet_address}
                    onChange={(e) => setFormData({ ...formData, target_wallet_address: e.target.value })}
                    placeholder="0x..."
                    style={{
                      width: '100%',
                      fontFamily: 'Comic Neue, cursive',
                      fontSize: '16px',
                      padding: '10px 14px',
                      border: '3px solid #ff0000',
                      background: '#220000',
                      color: '#fff',
                      boxShadow: '3px 3px 0 #000',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Reason */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '14px',
                    color: '#ff6b6b',
                    display: 'block',
                    marginBottom: '4px',
                  }}>
                    why they should be banished (required, 5+ chars)
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="rugged 3 projects and stole everyones lunch money..."
                    maxLength={500}
                    rows={3}
                    style={{
                      width: '100%',
                      fontFamily: 'Comic Neue, cursive',
                      fontSize: '16px',
                      padding: '10px 14px',
                      border: '3px solid #ff0000',
                      background: '#220000',
                      color: '#fff',
                      boxShadow: '3px 3px 0 #000',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '12px',
                    color: '#666',
                  }}>
                    {formData.reason.length}/500
                  </span>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9, rotate: -5 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    padding: '14px',
                    background: submitting ? '#666' : '#ff0000',
                    color: '#fff',
                    border: '3px solid #000',
                    cursor: submitting ? 'wait' : 'pointer',
                    boxShadow: '4px 4px 0 #000',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                  }}
                >
                  {submitting ? 'banishing...' : 'BANISH 🔨'}
                </motion.button>

                {/* Info text */}
                <p style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '12px',
                  color: '#ff6b6b',
                  textAlign: 'center',
                  marginTop: '10px',
                  opacity: 0.7,
                }}>
                  if others also banish ur target, u earn 250 pts
                </p>

                {/* Message */}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: messageIsSuccess
                        ? 'rgba(0, 255, 0, 0.15)'
                        : 'rgba(255, 0, 0, 0.15)',
                      border: '2px solid',
                      borderColor: messageIsSuccess ? '#00ff00' : '#ff4444',
                      fontFamily: 'Comic Neue, cursive',
                      fontSize: '14px',
                      color: '#fff',
                      textAlign: 'center',
                    }}
                  >
                    {message}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                style={{ textAlign: 'center', fontSize: '36px', padding: '50px', color: '#fff' }}
              >
                loadin...
              </motion.div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {leaderboard.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#fff',
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '20px',
                  }}>
                    no one banished yet... be da first! 🔨
                  </div>
                )}

                {leaderboard.map((entry, i) => {
                  const rank = i + 1
                  return (
                    <motion.div
                      key={entry.target_x_handle}
                      initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30, rotate: getRandomRotation(i) * 2 }}
                      animate={{ opacity: 1, x: 0, rotate: getRandomRotation(i) }}
                      transition={{ delay: i * 0.07, type: 'spring', stiffness: 200 }}
                      whileHover={{ scale: 1.02, rotate: 0, zIndex: 10, boxShadow: '8px 8px 0 #000' }}
                      style={{
                        background: getRandomGradient(i),
                        border: '3px solid #000',
                        padding: '12px 16px',
                        boxShadow: '5px 5px 0 #000',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      {/* Rank + Handle */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ minWidth: '55px', textAlign: 'center' }}>
                          <span style={{
                            fontFamily: 'Comic Neue, cursive',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#fff',
                            display: 'block',
                            textShadow: '1px 1px 0 #000',
                          }}>
                            #{rank}
                          </span>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: 'bold',
                            color: '#fff',
                            textShadow: '1px 1px 0 #000',
                          }}>
                            {entry.submission_count} {entry.submission_count === 1 ? 'report' : 'reports'}
                          </span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontFamily: 'Comic Neue, cursive',
                              fontSize: '18px',
                              fontWeight: 'bold',
                              color: '#fff',
                              textShadow: '1px 1px 0 #000',
                            }}>
                              @{entry.target_x_handle}
                            </span>
                            {rank <= 3 && (
                              <span style={{ fontSize: '20px' }}>
                                {rank === 1 ? '💀' : rank === 2 ? '🔨' : '🚫'}
                              </span>
                            )}
                          </div>

                          {/* Known wallets */}
                          {entry.target_wallets.length > 0 && (
                            <div style={{ marginBottom: '4px' }}>
                              {entry.target_wallets.map((w) => (
                                <span
                                  key={w}
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: '10px',
                                    color: 'rgba(255,255,255,0.7)',
                                    background: 'rgba(0,0,0,0.3)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    marginRight: '4px',
                                    display: 'inline-block',
                                    marginBottom: '2px',
                                  }}
                                >
                                  {truncateAddress(w)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Sample reasons */}
                          {entry.sample_reasons.map((reason, ri) => (
                            <div
                              key={ri}
                              style={{
                                fontFamily: 'Comic Neue, cursive',
                                fontSize: '13px',
                                color: 'rgba(255,255,255,0.9)',
                                lineHeight: 1.3,
                                marginBottom: '2px',
                              }}
                            >
                              {ri === 0 ? '💬' : '💬'} &quot;{reason}&quot;
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
