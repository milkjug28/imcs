'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import ConnectWallet from '@/components/ConnectWallet'

const TWEET_TEXT = "Im a wickud smahrt savannt. n urr a just a normiee..dont fade da imcs @imcsnft"

type ClaimStatus = {
  whitelisted: boolean
  total_points: number
  min_required: number
  x_linked: boolean
  x_username: string | null
  claimed: boolean
  claimed_at: string | null
  tweet_link: string | null
}

type Step = 'connect' | 'not_eligible' | 'link_x' | 'claim_wl' | 'tweet' | 'paste' | 'claimed'

function ClaimPageInner() {
  const { address, isConnected } = useWallet()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<ClaimStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('connect')
  const [tweetLink, setTweetLink] = useState('')
  const [claimError, setClaimError] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [tweetOpened, setTweetOpened] = useState(false)

  // Check for X OAuth callback params
  const xLinkedParam = searchParams.get('x_linked')
  const xUsernameParam = searchParams.get('x_username')
  const errorParam = searchParams.get('error')

  const fetchStatus = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await fetch(`/api/whitelist/status?wallet=${address}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        
        // Determine step
        if (data.claimed) {
          setStep('claimed')
        } else if (data.x_linked || xLinkedParam === 'true') {
          // X is linked, show claim WL step
          setStep('claim_wl')
        } else if (data.whitelisted) {
          setStep('link_x')
        } else {
          setStep('not_eligible')
        }
      }
    } catch (e) {
      console.error('Failed to fetch status:', e)
    }
    setLoading(false)
  }, [address, xLinkedParam])

  useEffect(() => {
    if (isConnected && address) {
      fetchStatus()
    } else {
      setLoading(false)
      setStep('connect')
    }
  }, [isConnected, address, fetchStatus])

  const handleLinkX = () => {
    if (!address) return
    window.location.href = `/api/auth/x?wallet=${address}`
  }

  const handleOpenTweet = () => {
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT)}`
    window.open(intentUrl, '_blank', 'width=600,height=400')
    setTweetOpened(true)
    setStep('paste')
  }

  const handleClaim = async () => {
    if (!address || !tweetLink.trim()) return
    setClaiming(true)
    setClaimError('')

    try {
      const res = await fetch('/api/whitelist/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, tweet_link: tweetLink.trim() }),
      })

      const data = await res.json()
      if (data.success) {
        setStep('claimed')
        // Trigger confetti
        try {
          const confetti = (await import('canvas-confetti')).default
          const end = Date.now() + 3000
          const frame = () => {
            confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ff00ff', '#ffff00', '#00ff00'] })
            confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ff00ff', '#ffff00', '#00ff00'] })
            if (Date.now() < end) requestAnimationFrame(frame)
          }
          frame()
        } catch {}
      } else {
        setClaimError(data.error || 'something went wrong')
      }
    } catch (e) {
      setClaimError('failed to claim. try again')
    }
    setClaiming(false)
  }

  const xUsername = status?.x_username || xUsernameParam

  // ==================== STEP: Connect wallet ====================
  if (step === 'connect' || !isConnected) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '600px', margin: '30px auto' }}>
          <h1 style={{
            fontSize: 'clamp(28px, 8vw, 46px)',
            color: '#000',
            textShadow: '3px 3px 0 #ff00ff',
            marginBottom: '20px',
          }}>
            savaantt lisst 🧙‍♂️
          </h1>
          <p style={{ fontSize: '22px', marginBottom: '30px' }}>
            connect ur wallut 2 check if ur a savant
          </p>
          <ConnectWallet label="connect wallut" />
        </div>
      </div>
    )
  }

  // ==================== STEP: Loading ====================
  if (loading) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '600px', margin: '30px auto' }}>
          <h2 className="form-title">checkin ur status...</h2>
          <div style={{ fontSize: '48px', animation: 'pulse 1s infinite' }}>⏳</div>
        </div>
      </div>
    )
  }

  // ==================== STEP: Not eligible ====================
  if (step === 'not_eligible') {
    const pts = status?.total_points || 0
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '600px', margin: '30px auto' }}>
          <h1 style={{
            fontSize: 'clamp(28px, 8vw, 42px)',
            color: '#000',
            textShadow: '3px 3px 0 #ff6347',
            marginBottom: '15px',
          }}>
            not savant yet 😤
          </h1>
          <p style={{ fontSize: '20px', marginBottom: '20px' }}>
            u need {status?.min_required || 1017} pts 2 b on da list
          </p>
          <div style={{
            fontSize: '42px',
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '3px 3px 0 #000',
            marginBottom: '10px',
          }}>
            {pts} / 1017
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '12px',
            height: '20px',
            border: '3px solid #000',
            overflow: 'hidden',
            maxWidth: '400px',
            margin: '0 auto 25px',
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #ff00ff, #00ff00)',
              height: '100%',
              width: `${Math.min(100, (pts / 1017) * 100)}%`,
              borderRadius: '8px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <button
            onClick={() => window.location.href = '/site/tasks'}
            className="submit-btn"
          >
            go grind tasks 💪
          </button>
        </div>
      </div>
    )
  }

  // ==================== STEP: Link X ====================
  if (step === 'link_x') {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '600px', margin: '30px auto' }}>
          <h1 style={{
            fontSize: 'clamp(28px, 8vw, 42px)',
            color: '#000',
            textShadow: '3px 3px 0 #00ff00',
            marginBottom: '15px',
          }}>
            cungraats savaantt! 🎉
          </h1>
          <p style={{ fontSize: '22px', marginBottom: '10px' }}>
            ur on da lisst wit {status?.total_points || '???'} pts!
          </p>
          <p style={{ fontSize: '20px', marginBottom: '30px', color: '#fff', textShadow: '2px 2px 0 #000' }}>
            link X 2 clayme ur spot
          </p>
          {errorParam && (
            <div style={{
              background: '#ff6347',
              color: '#fff',
              padding: '10px 20px',
              border: '3px solid #000',
              marginBottom: '20px',
              fontSize: '16px',
            }}>
              x auth failed: {errorParam}. try agen
            </div>
          )}
          <button
            onClick={handleLinkX}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '22px',
              padding: '15px 40px',
              background: '#000',
              color: '#fff',
              border: '4px solid #000',
              boxShadow: '5px 5px 0 #333',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'rotate(-2deg) scale(1.05)'
              e.currentTarget.style.boxShadow = '8px 8px 0 #333'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '5px 5px 0 #333'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            link X account
          </button>
        </div>
      </div>
    )
  }

  // ==================== STEP: Claim WL (X linked, ready to tweet) ====================
  if (step === 'claim_wl') {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '600px', margin: '30px auto' }}>
          <h1 style={{
            fontSize: 'clamp(28px, 8vw, 42px)',
            color: '#000',
            textShadow: '3px 3px 0 #ff00ff',
            marginBottom: '15px',
          }}>
            yoo @{xUsername}! 🔥
          </h1>
          <p style={{ fontSize: '20px', marginBottom: '10px' }}>
            ur X is linked. now claim ur spot!
          </p>
          <p style={{ fontSize: '16px', marginBottom: '25px', color: '#fff', textShadow: '1px 1px 0 #000' }}>
            post da official savant claim tweet:
          </p>

          {/* Tweet preview */}
          <div style={{
            background: '#fff',
            border: '4px solid #000',
            padding: '20px',
            marginBottom: '25px',
            textAlign: 'left',
            boxShadow: '5px 5px 0 #000',
            transform: 'rotate(-0.5deg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: '#000',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>@{xUsername}</span>
            </div>
            <p style={{ fontSize: '16px', lineHeight: 1.5, color: '#000' }}>
              {TWEET_TEXT}
            </p>
          </div>

          <button
            onClick={handleOpenTweet}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '22px',
              padding: '15px 40px',
              background: 'linear-gradient(135deg, #1DA1F2, #0d8bd9)',
              color: '#fff',
              border: '4px solid #000',
              boxShadow: '5px 5px 0 #000',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'rotate(1deg) scale(1.05)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
            }}
          >
            🐦 post tweet 2 claim
          </button>
        </div>
      </div>
    )
  }

  // ==================== STEP: Paste tweet link ====================
  if (step === 'paste') {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '600px', margin: '30px auto' }}>
          <h1 style={{
            fontSize: 'clamp(24px, 7vw, 38px)',
            color: '#000',
            textShadow: '3px 3px 0 #ffd700',
            marginBottom: '15px',
          }}>
            almost there! 🏁
          </h1>
          <p style={{ fontSize: '18px', marginBottom: '25px' }}>
            paste da link 2 ur tweet so we can verify u posted it
          </p>

          <div style={{ maxWidth: '450px', margin: '0 auto' }}>
            <input
              type="text"
              value={tweetLink}
              onChange={e => { setTweetLink(e.target.value); setClaimError('') }}
              placeholder="https://x.com/urname/status/123..."
              style={{
                width: '100%',
                fontFamily: 'Comic Neue, cursive',
                fontSize: '16px',
                padding: '14px 16px',
                border: '4px solid #000',
                boxShadow: '4px 4px 0 #000',
                marginBottom: '15px',
                boxSizing: 'border-box',
              }}
            />

            {claimError && (
              <div style={{
                background: '#ff6347',
                color: '#fff',
                padding: '10px',
                border: '3px solid #000',
                marginBottom: '15px',
                fontSize: '14px',
              }}>
                {claimError}
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={claiming || !tweetLink.trim()}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: '22px',
                padding: '15px 40px',
                background: claiming ? '#999' : 'linear-gradient(135deg, #00ff00, #00bfff)',
                color: '#000',
                border: '4px solid #000',
                boxShadow: '5px 5px 0 #000',
                cursor: claiming ? 'wait' : 'pointer',
                fontWeight: 'bold',
                width: '100%',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (!claiming) e.currentTarget.style.transform = 'rotate(-1deg) scale(1.03)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
              }}
            >
              {claiming ? 'verifyin...' : '✅ verify & claim'}
            </button>

            <p style={{
              fontSize: '13px',
              color: '#fff',
              textShadow: '1px 1px 0 #000',
              marginTop: '15px',
            }}>
              didnt post yet?{' '}
              <span
                onClick={handleOpenTweet}
                style={{ textDecoration: 'underline', cursor: 'pointer', color: '#ffff00' }}
              >
                open tweet agen
              </span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ==================== STEP: Claimed! ====================
  if (step === 'claimed') {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '600px', margin: '30px auto' }}>
          <div style={{ fontSize: '72px', marginBottom: '15px' }}>🧙‍♂️✨🎉</div>
          <h1 style={{
            fontSize: 'clamp(28px, 8vw, 46px)',
            color: '#000',
            textShadow: '3px 3px 0 #00ff00',
            marginBottom: '15px',
          }}>
            CLAIMED!!!
          </h1>
          <p style={{
            fontSize: '22px',
            color: '#fff',
            textShadow: '2px 2px 0 #000',
            marginBottom: '10px',
          }}>
            ur a confirmed savant now
          </p>
          {xUsername && (
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>
              linked as @{xUsername}
            </p>
          )}
          <p style={{ fontSize: '16px', marginBottom: '25px', color: '#fff', textShadow: '1px 1px 0 #000' }}>
            ur spot is locked in. dont lose it
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.href = '/site/profile'}
              className="submit-btn"
            >
              view profile
            </button>
            <button
              onClick={() => window.location.href = '/site/leaderboard'}
              className="submit-btn"
              style={{ background: '#ffff00' }}
            >
              leederboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '600px', margin: '30px auto' }}>
          <h2 className="form-title">loadin...</h2>
          <div style={{ fontSize: '48px' }}>⏳</div>
        </div>
      </div>
    }>
      <ClaimPageInner />
    </Suspense>
  )
}
