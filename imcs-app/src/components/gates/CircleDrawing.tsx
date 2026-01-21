'use client'

import { useState, useRef, useEffect } from 'react'
import { calculateCircleAccuracy, Point } from '@/lib/utils'

type CircleDrawingProps = {
  onSubmit: (score: number, accuracy: number) => void
  onGiveUp: () => void
}

export default function CircleDrawing({ onSubmit, onGiveUp }: CircleDrawingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [accuracy, setAccuracy] = useState(0)
  const [score, setScore] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Make canvas full viewport
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  const getColor = (acc: number): string => {
    // Green for perfect (100%), red for terrible (0%), gradient in between
    if (acc >= 0.95) return '#00ff00'
    if (acc >= 0.85) return '#88ff00'
    if (acc >= 0.75) return '#ffff00'
    if (acc >= 0.65) return '#ffaa00'
    if (acc >= 0.50) return '#ff6600'
    return '#ff0000'
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    setHasDrawn(false)
    setPoints([])
    setAccuracy(0)
    setScore(0)

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.beginPath()
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = clientX - rect.left
    const y = clientY - rect.top

    const newPoints = [...points, { x, y }]
    setPoints(newPoints)

    // Calculate real-time accuracy
    if (newPoints.length > 10) {
      const currentAcc = calculateCircleAccuracy(newPoints)
      setAccuracy(currentAcc)

      // Set line color based on accuracy
      ctx.strokeStyle = getColor(currentAcc)
    } else {
      ctx.strokeStyle = '#ffffff'
    }

    if (newPoints.length === 1) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    if (points.length < 30) {
      clearCanvas()
      return
    }

    setHasDrawn(true)

    // Final accuracy calculation
    const finalAccuracy = calculateCircleAccuracy(points)
    const accuracyPercent = Math.round(finalAccuracy * 100)
    setAccuracy(finalAccuracy)

    // Calculate score based on accuracy (x100 scale)
    let scoreEarned: number
    if (accuracyPercent >= 95) {
      scoreEarned = 300
    } else if (accuracyPercent >= 90) {
      scoreEarned = 250
    } else if (accuracyPercent >= 85) {
      scoreEarned = 200
    } else if (accuracyPercent >= 80) {
      scoreEarned = 150
    } else if (accuracyPercent >= 75) {
      scoreEarned = 100
    } else {
      scoreEarned = 0
    }

    setScore(scoreEarned)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setPoints([])
    setHasDrawn(false)
    setAccuracy(0)
    setScore(0)
  }

  const handleSubmit = async () => {
    const accuracyPercent = Math.round(accuracy * 100)

    // Recalculate score to ensure we have the correct value (x100 scale)
    // (don't rely on state which may not have updated yet)
    let scoreToSubmit: number
    if (accuracyPercent >= 95) {
      scoreToSubmit = 300
    } else if (accuracyPercent >= 90) {
      scoreToSubmit = 250
    } else if (accuracyPercent >= 85) {
      scoreToSubmit = 200
    } else if (accuracyPercent >= 80) {
      scoreToSubmit = 150
    } else if (accuracyPercent >= 75) {
      scoreToSubmit = 100
    } else {
      scoreToSubmit = 0
    }

    // Record attempt
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json')
      const { ip } = await ipResponse.json()

      await fetch('/api/access/circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip,
          success: accuracyPercent >= 75,
          score: accuracyPercent
        })
      })
    } catch (e) {
      console.error('Failed to record attempt:', e)
    }

    onSubmit(scoreToSubmit, accuracyPercent)
  }

  const accuracyPercent = Math.round(accuracy * 100)

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#000',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      {/* Instructions or score display */}
      {!hasDrawn && !isDrawing && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 'clamp(28px, 8vw, 48px)',
          color: '#fff',
          textShadow: '3px 3px 0 #000',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 1,
          padding: '0 20px',
          width: '100%',
          maxWidth: '500px'
        }}>
          draw a perfect circle
        </div>
      )}

      {hasDrawn && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 1
        }}>
          <div style={{
            fontSize: 'clamp(60px, 20vw, 120px)',
            color: getColor(accuracy),
            textShadow: '4px 4px 0 #000',
            fontWeight: 'bold',
            marginBottom: '20px'
          }}>
            {accuracyPercent}%
          </div>
          {score > 0 && (
            <div style={{
              fontSize: 'clamp(24px, 6vw, 36px)',
              color: '#fff',
              textShadow: '2px 2px 0 #000'
            }}>
              {score} points
            </div>
          )}
        </div>
      )}

      {/* Full-screen canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{
          cursor: 'crosshair',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />

      {/* Buttons (bottom center) */}
      {hasDrawn && (
        <div style={{
          position: 'fixed',
          bottom: 'max(30px, env(safe-area-inset-bottom, 30px))',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '12px',
          zIndex: 10,
          padding: '0 15px',
          width: '100%',
          maxWidth: '400px'
        }}>
          <button
            onClick={handleSubmit}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: 'clamp(18px, 5vw, 24px)',
              padding: '12px 25px',
              background: score > 0 ? '#00ff00' : '#ffff00',
              border: '4px solid #fff',
              cursor: 'pointer',
              boxShadow: '5px 5px 0 #fff',
              color: '#000',
              fontWeight: 'bold',
              flex: '1 1 auto',
              minWidth: '120px'
            }}
          >
            submit
          </button>
          <button
            onClick={onGiveUp}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: 'clamp(18px, 5vw, 24px)',
              padding: '12px 25px',
              background: '#ff6b9d',
              border: '4px solid #fff',
              cursor: 'pointer',
              boxShadow: '5px 5px 0 #fff',
              color: '#fff',
              fontWeight: 'bold',
              textShadow: '2px 2px 0 #000',
              flex: '1 1 auto',
              minWidth: '120px'
            }}
          >
            dis is hard
          </button>
        </div>
      )}

      {!hasDrawn && (
        <button
          onClick={clearCanvas}
          style={{
            position: 'fixed',
            bottom: 'max(30px, env(safe-area-inset-bottom, 30px))',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'Comic Neue, cursive',
            fontSize: 'clamp(16px, 4vw, 20px)',
            padding: '12px 25px',
            background: '#ccc',
            border: '3px solid #fff',
            cursor: 'pointer',
            boxShadow: '3px 3px 0 #fff',
            color: '#000',
            zIndex: 10,
            opacity: points.length > 0 ? 1 : 0.5
          }}
        >
          clear n try agen
        </button>
      )}
    </div>
  )
}
