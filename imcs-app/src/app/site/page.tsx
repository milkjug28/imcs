'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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

type Step = 'idle' | 'loading' | 'not_eligible' | 'link_x' | 'claim_wl' | 'paste' | 'claimed'

const emojis = [
  { emoji: '⭐', top: '10%', left: '15%', delay: '0s' },
  { emoji: '✨', top: '25%', right: '20%', delay: '0.5s' },
  { emoji: '💫', top: '50%', left: '8%', delay: '1s' },
  { emoji: '🌟', top: '15%', right: '10%', delay: '1.5s' },
  { emoji: '⭐', bottom: '25%', left: '25%', delay: '2s' },
  { emoji: '✨', bottom: '35%', right: '15%', delay: '2.5s' },
  { emoji: '💫', top: '40%', right: '30%', delay: '3s' },
  { emoji: '🌟', bottom: '15%', left: '10%', delay: '3.5s' },
]

function HomePageInner() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<ClaimStatus | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [tweetLink, setTweetLink] = useState('')
  const [claimError, setClaimError] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [wlCount, setWlCount] = useState<number | null>(() => {
    // Try to read preloaded count from splash page
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('wlCount')
      if (cached) return parseInt(cached, 10)
    }
    return null
  })

  // Fetch WL count if not preloaded by splash
  useEffect(() => {
    if (wlCount !== null) return // already have it
    fetch('/api/leaderboard/submissions?limit=1000', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const count = Array.isArray(data) ? data.filter((u: any) => u.whitelist_status === 'approved').length : 0
        setWlCount(count)
        sessionStorage.setItem('wlCount', String(count))
      })
      .catch(() => setWlCount(0))
  }, [wlCount])

  // X OAuth callback params
  const xLinkedParam = searchParams.get('x_linked')
  const xUsernameParam = searchParams.get('x_username')
  const errorParam = searchParams.get('error')

  const fetchStatus = useCallback(async () => {
    if (!address) return
    setStep('loading')
    try {
      const res = await fetch(`/api/whitelist/status?wallet=${address}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (res.ok) {
        const data = await res.json()
        setStatus(data)

        if (data.claimed) {
          setStep('claimed')
        } else if (data.x_linked || xLinkedParam === 'true') {
          setStep('claim_wl')
        } else if (data.whitelisted) {
          setStep('link_x')
        } else {
          setStep('not_eligible')
        }
      } else {
        setStep('not_eligible')
      }
    } catch {
      setStep('not_eligible')
    }
  }, [address, xLinkedParam])

  useEffect(() => {
    if (isConnected && address) {
      fetchStatus()
    } else {
      setStep('idle')
      setStatus(null)
    }
  }, [isConnected, address, fetchStatus])

  const handleLinkX = () => {
    if (!address) return
    window.location.href = `/api/auth/x?wallet=${address}`
  }

  const handleOpenTweet = () => {
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT)}`
    window.open(intentUrl, '_blank', 'width=600,height=400')
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
    } catch {
      setClaimError('failed to claim. try again')
    }
    setClaiming(false)
  }

  const xUsername = status?.x_username || xUsernameParam

  // ============ Render the claim card content based on step ============

  const renderClaimCard = () => {
    // LOADING spinner
    if (step === 'loading') {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="spinner" style={{
            width: '48px',
            height: '48px',
            border: '5px solid rgba(0,0,0,0.1)',
            borderTop: '5px solid #ff00ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 20px',
          }} />
          <p style={{ fontSize: '20px', color: '#000' }}>
            checkin ur status...
          </p>
        </div>
      )
    }

    // NOT CONNECTED — show connect prompt with FOMO
    if (step === 'idle' || !isConnected) {
      // Show spinner while wlCount loads
      if (wlCount === null) {
        return (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '5px solid rgba(0,0,0,0.1)',
              borderTop: '5px solid #ff00ff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{ fontSize: '20px', color: '#000' }}>
              loadin...
            </p>
          </div>
        )
      }

      return (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 6vw, 32px)',
            color: '#000',
            textShadow: '2px 2px 0 #ff00ff',
            marginBottom: '12px',
          }}>
            savaant lisstt is lyve 🧙‍♂️🔥
          </h2>
          <p style={{ fontSize: '17px', marginBottom: '8px', color: '#000', lineHeight: 1.5 }}>
            ownlee{' '}
            <span style={{
              fontWeight: 'bold',
              fontSize: '22px',
              color: '#fff',
              textShadow: '2px 2px 0 #000',
              padding: '0 4px',
            }}>{wlCount}</span>
            {' '}r speshul enuff
          </p>
          <p style={{ fontSize: '17px', marginBottom: '25px', color: '#000', lineHeight: 1.5 }}>
            chek ur wallut now n clayme ur spott savaant
          </p>
          <ConnectWallet label="chek wallut 👀" />
        </div>
      )
    }

    // NOT ELIGIBLE
    if (step === 'not_eligible') {
      const pts = status?.total_points || 0
      return (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 6vw, 32px)',
            color: '#000',
            textShadow: '2px 2px 0 #ff6347',
            marginBottom: '12px',
          }}>
            not savant yet 😤
          </h2>
          <p style={{ fontSize: '18px', marginBottom: '15px', color: '#000' }}>
            u need 1017 pts 2 b on da list
          </p>
          <div style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '3px 3px 0 #000',
            marginBottom: '8px',
          }}>
            {pts} / 1017
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '12px',
            height: '18px',
            border: '3px solid #000',
            overflow: 'hidden',
            maxWidth: '350px',
            margin: '0 auto 20px',
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
            onClick={() => router.push('/site/tasks')}
            className="submit-btn"
          >
            go grind tasks 💪
          </button>
        </div>
      )
    }

    // LINK X — eligible, need to link X
    if (step === 'link_x') {
      return (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 6vw, 32px)',
            color: '#000',
            textShadow: '2px 2px 0 #00ff00',
            marginBottom: '12px',
          }}>
            cungraats savaantt! 🎉
          </h2>
          <p style={{ fontSize: '18px', marginBottom: '8px', color: '#000' }}>
            ur on da lisst wit {status?.total_points || '???'} pts
          </p>
          <p style={{ fontSize: '17px', marginBottom: '25px', color: '#fff', textShadow: '2px 2px 0 #000' }}>
            link X 2 clayme ur spot
          </p>
          {errorParam && (
            <div style={{
              background: '#ff6347',
              color: '#fff',
              padding: '8px 16px',
              border: '3px solid #000',
              marginBottom: '15px',
              fontSize: '14px',
            }}>
              x auth failed: {errorParam}. try agen
            </div>
          )}
          <button
            onClick={handleLinkX}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '20px',
              padding: '14px 35px',
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            link X account
          </button>
        </div>
      )
    }

    // CLAIM WL — X linked, show tweet
    if (step === 'claim_wl') {
      return (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <h2 style={{
            fontSize: 'clamp(20px, 6vw, 30px)',
            color: '#000',
            textShadow: '2px 2px 0 #ff00ff',
            marginBottom: '12px',
          }}>
            yoo @{xUsername}! 🔥
          </h2>
          <p style={{ fontSize: '16px', marginBottom: '20px', color: '#000' }}>
            post da claim tweet 2 lock in ur spot
          </p>

          {/* Tweet preview */}
          <div style={{
            background: '#fff',
            border: '3px solid #000',
            padding: '15px',
            marginBottom: '20px',
            textAlign: 'left',
            boxShadow: '4px 4px 0 #000',
            transform: 'rotate(-0.5deg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                background: '#000',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>@{xUsername}</span>
            </div>
            <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#000', margin: 0 }}>
              {TWEET_TEXT}
            </p>
          </div>

          <button
            onClick={handleOpenTweet}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '20px',
              padding: '14px 35px',
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
            onMouseEnter={e => e.currentTarget.style.transform = 'rotate(1deg) scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            🐦 post tweet 2 claim
          </button>
        </div>
      )
    }

    // PASTE tweet link
    if (step === 'paste') {
      return (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <h2 style={{
            fontSize: 'clamp(20px, 6vw, 30px)',
            color: '#000',
            textShadow: '2px 2px 0 #ffd700',
            marginBottom: '12px',
          }}>
            almost there! 🏁
          </h2>
          <p style={{ fontSize: '16px', marginBottom: '20px', color: '#000' }}>
            paste da link 2 ur tweet so we can verify
          </p>

          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <input
              type="text"
              value={tweetLink}
              onChange={e => { setTweetLink(e.target.value); setClaimError('') }}
              placeholder="https://x.com/urname/status/123..."
              style={{
                width: '100%',
                fontFamily: 'Comic Neue, cursive',
                fontSize: '15px',
                padding: '12px 14px',
                border: '4px solid #000',
                boxShadow: '4px 4px 0 #000',
                marginBottom: '12px',
                boxSizing: 'border-box',
              }}
            />

            {claimError && (
              <div style={{
                background: '#ff6347',
                color: '#fff',
                padding: '8px',
                border: '3px solid #000',
                marginBottom: '12px',
                fontSize: '13px',
              }}>
                {claimError}
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={claiming || !tweetLink.trim()}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: '20px',
                padding: '14px 35px',
                background: claiming ? '#999' : 'linear-gradient(135deg, #00ff00, #00bfff)',
                color: '#000',
                border: '4px solid #000',
                boxShadow: '5px 5px 0 #000',
                cursor: claiming ? 'wait' : 'pointer',
                fontWeight: 'bold',
                width: '100%',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!claiming) e.currentTarget.style.transform = 'rotate(-1deg) scale(1.03)' }}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              {claiming ? 'verifyin...' : '✅ verify & claim'}
            </button>

            <p style={{ fontSize: '12px', color: '#fff', textShadow: '1px 1px 0 #000', marginTop: '12px' }}>
              didnt post yet?{' '}
              <span onClick={handleOpenTweet} style={{ textDecoration: 'underline', cursor: 'pointer', color: '#ffff00' }}>
                open tweet agen
              </span>
            </p>
          </div>
        </div>
      )
    }

    // CLAIMED!
    if (step === 'claimed') {
      return (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: '56px', marginBottom: '10px' }}>🧙‍♂️✨🎉</div>
          <h2 style={{
            fontSize: 'clamp(24px, 7vw, 36px)',
            color: '#000',
            textShadow: '2px 2px 0 #00ff00',
            marginBottom: '10px',
          }}>
            CLAIMED!!!
          </h2>
          <p style={{ fontSize: '20px', color: '#fff', textShadow: '2px 2px 0 #000', marginBottom: '8px' }}>
            ur a confirmed savant now
          </p>
          {xUsername && (
            <p style={{ fontSize: '16px', marginBottom: '8px', color: '#000' }}>
              linked as @{xUsername}
            </p>
          )}
          <p style={{ fontSize: '14px', marginBottom: '20px', color: '#fff', textShadow: '1px 1px 0 #000' }}>
            ur spot is locked in. dont lose it
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/site/profile')} className="submit-btn">
              view profile
            </button>
            <button onClick={() => router.push('/site/leaderboard')} className="submit-btn" style={{ background: '#ffff00' }}>
              leederboard
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="page active" id="home" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Background "imaginate" text */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
        textAlign: 'center',
        padding: '0 10px',
        width: '100%',
        pointerEvents: 'none',
      }}>
        <h1 style={{
          fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
          fontSize: 'clamp(60px, 15vw, 180px)',
          color: '#ffff00',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          WebkitTextStroke: '3px #000',
          textShadow: '4px 4px 0 #000',
          margin: 0,
          lineHeight: 1,
          fontWeight: 700,
        }}>
          imaginate
        </h1>
      </div>

      {/* Floating emojis */}
      {emojis.map((item, i) => (
        <div
          key={i}
          className="floating-emoji"
          style={{
            top: item.top,
            bottom: item.bottom,
            left: item.left,
            right: item.right,
            animationDelay: item.delay,
          }}
        >
          {item.emoji}
        </div>
      ))}

      {/* Claim card — centered */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '20px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
          border: '5px solid #000',
          boxShadow: '8px 8px 0 #000',
          maxWidth: '450px',
          width: '100%',
          transform: 'rotate(-1deg)',
        }}>
          {renderClaimCard()}
        </div>
      </div>

    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="page active" id="home" style={{ position: 'relative', minHeight: '70vh' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
            border: '5px solid #000',
            boxShadow: '8px 8px 0 #000',
            maxWidth: '450px',
            width: '100%',
            transform: 'rotate(-1deg)',
            textAlign: 'center',
            padding: '40px 20px',
          }}>
            <div className="loading-spinner" style={{ marginBottom: '20px' }} />
            <p style={{ fontSize: '20px', color: '#000' }}>loadin...</p>
          </div>
        </div>
      </div>
    }>
      <HomePageInner />
    </Suspense>
  )
}
