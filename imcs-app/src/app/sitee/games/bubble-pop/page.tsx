'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'

type Bubble = {
  id: number
  x: number
  y: number
  size: number
  speed: number
  color: string
}

const COLORS = ['#ff6b9d', '#ffd700', '#00ff00', '#00bfff', '#ff00ff', '#ffff00']
const GAME_DURATION = 30
const MAX_ATTEMPTS = 5

export default function BubblePopGame() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [maxReached, setMaxReached] = useState(false)
  const [pointsAdded, setPointsAdded] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const bubbleIdRef = useRef(0)
  const lastSpawnRef = useRef(0)

  // Fetch current attempt count on mount
  useEffect(() => {
    const fetchAttempts = async () => {
      if (!address) return
      try {
        const res = await fetch(`/api/tasks/${address}`)
        if (res.ok) {
          const data = await res.json()
          const bubbleTask = data.tasks?.find((t: any) => t.task_type === 'bubble')
          if (bubbleTask) {
            const count = bubbleTask.completion_count || 1
            setAttemptsLeft(MAX_ATTEMPTS - count)
            if (count >= MAX_ATTEMPTS) {
              setMaxReached(true)
            }
          } else {
            setAttemptsLeft(MAX_ATTEMPTS)
          }
        }
      } catch (e) {
        console.error('Failed to fetch attempts:', e)
      }
    }
    fetchAttempts()
  }, [address])

  // Spawn new bubble - bigger and slower for easier gameplay
  const spawnBubble = useCallback(() => {
    if (!containerRef.current) return null

    const width = containerRef.current.clientWidth
    // Bigger bubbles (60-100px instead of 40-80px)
    const size = 60 + Math.random() * 40
    const x = Math.random() * (width - size)

    return {
      id: bubbleIdRef.current++,
      x,
      y: window.innerHeight,
      size,
      // Slower speed (1-2 instead of 2-5)
      speed: 1 + Math.random() * 1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  }, [])

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const gameLoop = (timestamp: number) => {
      // Spawn bubbles every ~800ms (slower spawn rate)
      if (timestamp - lastSpawnRef.current > 800 - Math.min(score * 2, 300)) {
        const newBubble = spawnBubble()
        if (newBubble) {
          setBubbles(prev => [...prev, newBubble])
        }
        lastSpawnRef.current = timestamp
      }

      // Move bubbles up
      setBubbles(prev =>
        prev
          .map(b => ({ ...b, y: b.y - b.speed }))
          .filter(b => b.y > -100)
      )

      animationRef.current = requestAnimationFrame(gameLoop)
    }

    animationRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState, spawnBubble, score])

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('finished')
          setShowSharePrompt(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gameState])

  const startGame = () => {
    setGameState('playing')
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setBubbles([])
    bubbleIdRef.current = 0
    lastSpawnRef.current = 0
  }

  const popBubble = (id: number) => {
    setBubbles(prev => prev.filter(b => b.id !== id))
    setScore(prev => prev + 1)
  }

  const handleShare = () => {
    const shareText = `popped ${score} bubbles in 30 sec 🫧 imcs.world #IMCS`
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    window.open(shareUrl, '_blank')
  }

  const saveScore = async () => {
    if (!address) {
      return
    }

    try {
      const response = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: address,
          task_type: 'bubble',
          score: score,
        }),
      })
      const result = await response.json()

      if (result.max_reached) {
        setMaxReached(true)
        setPointsAdded(0)
      } else if (result.success) {
        setAttemptsLeft(result.attempts_left ?? null)
        // Use the points that were actually added (from API response or fallback to score)
        setPointsAdded(result.added !== undefined ? result.added : score)
      } else {
        // If API failed but we have a score, still show it
        setPointsAdded(score)
      }
    } catch (e) {
      console.error('Failed to save score:', e)
      // If save failed, still show the earned score
      setPointsAdded(score)
    }
  }

  useEffect(() => {
    if (gameState === 'finished' && address) {
      saveScore()
    }
  }, [gameState, address]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ready screen
  if (gameState === 'ready') {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(180deg, #87CEEB 0%, #00bfff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        <h1 style={{
          fontSize: 'clamp(36px, 10vw, 64px)',
          color: '#fff',
          textShadow: '4px 4px 0 #000',
          marginBottom: '20px',
        }}>
          🫧 bubble pop 🫧
        </h1>

        <p style={{
          fontSize: 'clamp(18px, 5vw, 24px)',
          color: '#000',
          marginBottom: '30px',
          textAlign: 'center',
          padding: '0 20px',
        }}>
          pop as many bubbles as u can in 30 seconds!
        </p>

        {attemptsLeft !== null && (
          <p style={{
            fontSize: 'clamp(14px, 4vw, 18px)',
            color: attemptsLeft > 0 ? '#006600' : '#cc0000',
            marginBottom: '20px',
            background: 'rgba(255,255,255,0.8)',
            padding: '8px 16px',
            borderRadius: '8px',
          }}>
            {attemptsLeft > 0
              ? `${attemptsLeft}/${MAX_ATTEMPTS} attempts left for points`
              : 'max attempts reached (no more points)'}
          </p>
        )}

        <button
          onClick={startGame}
          style={{
            fontFamily: 'Comic Neue, cursive',
            fontSize: 'clamp(24px, 6vw, 36px)',
            padding: '20px 50px',
            background: '#00ff00',
            border: '5px solid #000',
            cursor: 'pointer',
            boxShadow: '8px 8px 0 #000',
            transform: 'rotate(-2deg)',
            animation: 'pulse 2s infinite',
          }}
        >
          START!
        </button>

        <button
          onClick={() => router.push('/sitee/tasks')}
          style={{
            fontFamily: 'Comic Neue, cursive',
            fontSize: '18px',
            padding: '10px 20px',
            background: 'transparent',
            border: '2px solid #000',
            cursor: 'pointer',
            marginTop: '20px',
          }}
        >
          bak 2 tasks
        </button>
      </div>
    )
  }

  // Game screen
  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(180deg, #87CEEB 0%, #00bfff 100%)',
        overflow: 'hidden',
        cursor: 'crosshair',
        zIndex: 9999,
      }}
    >
      {/* HUD */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '30px',
        zIndex: 100,
      }}>
        <div style={{
          background: '#fff',
          padding: '15px 30px',
          border: '4px solid #000',
          boxShadow: '4px 4px 0 #000',
        }}>
          <span style={{ fontSize: '32px', fontWeight: 'bold' }}>⏱️ {timeLeft}</span>
        </div>
        <div style={{
          background: '#ffff00',
          padding: '15px 30px',
          border: '4px solid #000',
          boxShadow: '4px 4px 0 #000',
        }}>
          <span style={{ fontSize: '32px', fontWeight: 'bold' }}>🫧 {score}</span>
        </div>
      </div>

      {/* Bubbles - with larger clickable area */}
      {bubbles.map(bubble => (
        <div
          key={bubble.id}
          onClick={() => popBubble(bubble.id)}
          style={{
            position: 'absolute',
            // Offset to center the larger hitbox
            left: bubble.x - 10,
            top: bubble.y - 10,
            // Larger clickable area (20px padding around bubble)
            width: bubble.size + 20,
            height: bubble.size + 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: bubble.size,
              height: bubble.size,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, white, ${bubble.color})`,
              border: '3px solid rgba(255,255,255,0.5)',
              boxShadow: `0 0 20px ${bubble.color}`,
              transition: 'transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          />
        </div>
      ))}

      {/* Finished overlay */}
      {gameState === 'finished' && showSharePrompt && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}>
          <h2 style={{
            fontSize: 'clamp(36px, 10vw, 64px)',
            color: '#fff',
            textShadow: '4px 4px 0 #ff00ff',
            marginBottom: '10px',
          }}>
            time&apos;s up!
          </h2>

          <div style={{
            fontSize: 'clamp(48px, 15vw, 96px)',
            color: '#ffff00',
            textShadow: '4px 4px 0 #000',
            marginBottom: '20px',
          }}>
            {score}
          </div>

            <p style={{
            fontSize: '24px',
            color: '#fff',
            marginBottom: '10px',
          }}>
            bubbles popped = {score}
          </p>

          <p style={{
            fontSize: '20px',
            color: maxReached ? '#ff6b6b' : '#00ff00',
            marginBottom: '30px',
          }}>
            {maxReached
              ? 'max attempts reached (no points added)'
              : pointsAdded > 0
                ? `+${pointsAdded} points earned!`
                : `+${score} points!`}
            {attemptsLeft !== null && attemptsLeft > 0 && !maxReached && (
              <span style={{ display: 'block', fontSize: '16px', marginTop: '5px' }}>
                {attemptsLeft} attempts left
              </span>
            )}
          </p>

          <div style={{
            display: 'flex',
            gap: '15px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            padding: '0 20px',
          }}>
            <button
              onClick={handleShare}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: '24px',
                padding: '15px 30px',
                background: '#1DA1F2',
                border: '4px solid #fff',
                cursor: 'pointer',
                color: '#fff',
                boxShadow: '4px 4px 0 #fff',
              }}
            >
              share on X 🐦
            </button>

            <button
              onClick={startGame}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: '24px',
                padding: '15px 30px',
                background: '#00ff00',
                border: '4px solid #000',
                cursor: 'pointer',
                boxShadow: '4px 4px 0 #000',
              }}
            >
              play again
            </button>

            <button
              onClick={() => router.push('/sitee/tasks')}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: '24px',
                padding: '15px 30px',
                background: '#ff6b9d',
                border: '4px solid #000',
                cursor: 'pointer',
                boxShadow: '4px 4px 0 #000',
              }}
            >
              bak 2 tasks
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
