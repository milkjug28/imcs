'use client'

import { useState, useRef, useEffect } from 'react'
import { calculateCircleAccuracy, getRandomPastelColor, Point } from '@/lib/utils'

type CircleDrawingProps = {
  onSuccess: (score: number, accuracy: number) => void
  onFailure: (failedAttempts: number) => void
}

export default function CircleDrawing({ onSuccess, onFailure }: CircleDrawingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [drawColor] = useState(getRandomPastelColor())
  const [message, setMessage] = useState('draw a perfect circle, use ur imaginashun')
  const [failedAttempts, setFailedAttempts] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = Math.min(window.innerWidth - 40, 800)
    canvas.height = Math.min(window.innerHeight - 200, 600)

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    setPoints([])
    setMessage('draw a perfect circle, use ur imaginashun')

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Start drawing
    ctx.beginPath()
    ctx.strokeStyle = drawColor
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.shadowBlur = 15
    ctx.shadowColor = drawColor
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

    if (points.length === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }

    setPoints(prev => [...prev, { x, y }])
  }

  const stopDrawing = async () => {
    if (!isDrawing) return
    setIsDrawing(false)

    if (points.length < 30) {
      setMessage('draw more than that dummie')
      return
    }

    // Calculate accuracy
    const accuracy = calculateCircleAccuracy(points)
    const accuracyPercent = Math.round(accuracy * 100)

    // Determine if passed and score earned
    if (accuracyPercent >= 75) {
      // Calculate score based on accuracy
      let scoreEarned: number
      if (accuracyPercent >= 95) {
        scoreEarned = 3
      } else if (accuracyPercent >= 90) {
        scoreEarned = 2.5
      } else if (accuracyPercent >= 85) {
        scoreEarned = 2
      } else if (accuracyPercent >= 80) {
        scoreEarned = 1.5
      } else {
        scoreEarned = 1
      }

      setMessage(`🎉 ${accuracyPercent}% - u earned ${scoreEarned} points!`)

      // Record success
      try {
        await fetch('/api/access/circle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: await getClientIP(),
            success: true,
            score: accuracyPercent
          })
        })
      } catch (e) {
        console.error('Failed to record attempt:', e)
      }

      // Call success callback with score and accuracy
      setTimeout(() => onSuccess(scoreEarned, accuracyPercent), 2000)
    } else {
      // Failed
      const newFailedAttempts = failedAttempts + 1
      setFailedAttempts(newFailedAttempts)
      setMessage(`${accuracyPercent}% - dat not a circle dummie! try agen (attempt ${newFailedAttempts}/3)`)

      // Record failure
      try {
        const response = await fetch('/api/access/circle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: await getClientIP(),
            success: false,
            score: accuracyPercent
          })
        })
        const data = await response.json()

        // Check if failed 3 times
        if (data.failedAttempts >= 3) {
          setTimeout(() => onFailure(data.failedAttempts), 1500)
        }
      } catch (e) {
        console.error('Failed to record attempt:', e)
      }
    }

    setPoints([])
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setPoints([])
    setMessage('draw a perfect circle, use ur imaginashun')
  }

  return (
    <div className="circle-canvas-container">
      <div className="circle-instructions">{message}</div>

      <canvas
        ref={canvasRef}
        className="circle-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      <button className="circle-clear-btn" onClick={clearCanvas}>
        clear n try agen
      </button>
    </div>
  )
}

// Helper to get client IP
async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch {
    return '0.0.0.0'
  }
}
