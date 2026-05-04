'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'

const COLORS = [
  '#000000', '#ffffff', '#ff0000', '#ff6b9d', '#ff00ff',
  '#ffd700', '#ffff00', '#00ff00', '#00bfff', '#0000ff',
  '#8b4513', '#ff8c00', '#808080', '#c0c0c0',
]

const BRUSH_SIZES = [4, 8, 16]

// Convert hex color to RGBA array
const hexToRgba = (hex: string): [number, number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), 255]
  }
  return [0, 0, 0, 255]
}

// Flood fill algorithm
const floodFill = (ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: [number, number, number, number]) => {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const data = imageData.data
  const width = ctx.canvas.width
  const height = ctx.canvas.height

  const startPos = (startY * width + startX) * 4
  const startR = data[startPos]
  const startG = data[startPos + 1]
  const startB = data[startPos + 2]
  const startA = data[startPos + 3]

  // Don't fill if clicking on the same color
  if (startR === fillColor[0] && startG === fillColor[1] && startB === fillColor[2] && startA === fillColor[3]) {
    return
  }

  const stack: [number, number][] = [[startX, startY]]
  const visited = new Set<string>()

  const matchesStart = (pos: number) => {
    return Math.abs(data[pos] - startR) < 10 &&
           Math.abs(data[pos + 1] - startG) < 10 &&
           Math.abs(data[pos + 2] - startB) < 10 &&
           Math.abs(data[pos + 3] - startA) < 10
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop()!
    const key = `${x},${y}`

    if (visited.has(key)) continue
    if (x < 0 || x >= width || y < 0 || y >= height) continue

    const pos = (y * width + x) * 4
    if (!matchesStart(pos)) continue

    visited.add(key)

    data[pos] = fillColor[0]
    data[pos + 1] = fillColor[1]
    data[pos + 2] = fillColor[2]
    data[pos + 3] = fillColor[3]

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  ctx.putImageData(imageData, 0, 0)
}

export default function DrawSavantGame() {
  const router = useRouter()
  const { address } = useWallet()
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#ff00ff')
  const [brushSize, setBrushSize] = useState(8)
  const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [canvasSize, setCanvasSize] = useState(500)
  const [copySuccess, setCopySuccess] = useState(false)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  // Check if already completed
  useEffect(() => {
    const checkCompletion = async () => {
      if (!address) return
      try {
        const res = await fetch(`/api/tasks/${address}`)
        if (res.ok) {
          const data = await res.json()
          const paintTask = data.tasks?.find((t: any) => t.task_type === 'paint')
          if (paintTask) {
            setAlreadyCompleted(true)
          }
        }
      } catch (e) {
        console.error('Failed to check completion:', e)
      }
    }
    checkCompletion()
  }, [address])

  // Initialize canvases
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current
    const drawCanvas = drawCanvasRef.current
    if (!bgCanvas || !drawCanvas) return

    const bgCtx = bgCanvas.getContext('2d')
    const drawCtx = drawCanvas.getContext('2d')
    if (!bgCtx || !drawCtx) return

    // Set canvas size - must be square for the character image
    const maxSize = Math.min(window.innerWidth - 40, window.innerHeight - 280, 500)
    setCanvasSize(maxSize)
    bgCanvas.width = maxSize
    bgCanvas.height = maxSize
    drawCanvas.width = maxSize
    drawCanvas.height = maxSize

    // White background on the background canvas
    bgCtx.fillStyle = '#ffffff'
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height)

    // Load and draw base image on background canvas
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height)
    }
    img.src = '/assets/character/blank-IMCS.png'
  }, [])

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === 'fill') {
      const canvas = drawCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const pos = getPos(e)
      const x = Math.floor(pos.x)
      const y = Math.floor(pos.y)

      floodFill(ctx, x, y, hexToRgba(color))
      setHasDrawn(true)
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === 'fill') {
      handleCanvasClick(e)
      return
    }
    setIsDrawing(true)
    const pos = getPos(e)
    lastPosRef.current = pos
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === 'fill') return

    const canvas = drawCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pos = getPos(e)
    const lastPos = lastPosRef.current

    if (lastPos) {
      ctx.beginPath()
      ctx.moveTo(lastPos.x, lastPos.y)
      ctx.lineTo(pos.x, pos.y)

      if (tool === 'eraser') {
        // Use destination-out to erase only what's on this canvas
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = color
      }

      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over'

      setHasDrawn(true)
    }

    lastPosRef.current = pos
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    lastPosRef.current = null
  }

  const clearCanvas = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear only the drawing canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const getCompositeCanvas = () => {
    const bgCanvas = bgCanvasRef.current
    const drawCanvas = drawCanvasRef.current
    if (!bgCanvas || !drawCanvas) return null

    // Create a temporary canvas to composite both layers
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvasSize
    tempCanvas.height = canvasSize
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return null

    // Draw background first, then drawing layer on top
    tempCtx.drawImage(bgCanvas, 0, 0)
    tempCtx.drawImage(drawCanvas, 0, 0)

    return tempCanvas
  }

  const saveImage = () => {
    const tempCanvas = getCompositeCanvas()
    if (!tempCanvas) return

    const link = document.createElement('a')
    link.download = 'my-savant-masterpiece.png'
    link.href = tempCanvas.toDataURL('image/png')
    link.click()
  }

  const copyImage = async () => {
    const tempCanvas = getCompositeCanvas()
    if (!tempCanvas) return

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        tempCanvas.toBlob(resolve, 'image/png')
      })

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      }
    } catch (e) {
      console.error('Failed to copy image:', e)
      alert('copy failed - try download instead')
    }
  }

  const handleComplete = async () => {
    if (!hasDrawn) {
      alert('draw sumthing first dummie!')
      return
    }

    // Save score
    if (address) {
      try {
        const response = await fetch('/api/tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: address,
            task_type: 'paint',
            score: 200,
          }),
        })
        const result = await response.json()
        setPointsEarned(result.added || (alreadyCompleted ? 0 : 200))
        if (!alreadyCompleted && result.success) {
          setAlreadyCompleted(true)
        }
      } catch (e) {
        console.error('Failed to save score:', e)
      }
    }

    setShowSharePrompt(true)
  }

  const handleShare = () => {
    const shareText = `created my savant masterpiece 🎨 imcs.world #IMCS`
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    window.open(shareUrl, '_blank')
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #c0c0c0 0%, #808080 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '15px',
      overflow: 'auto',
      zIndex: 9999,
    }}>
      {/* Title bar (MS Paint style) */}
      <div style={{
        width: '100%',
        maxWidth: '640px',
        background: 'linear-gradient(90deg, #000080, #1084d0)',
        padding: '5px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        <span style={{ color: '#fff', fontWeight: 'bold' }}>
          🎨 savant.exe - Paint
        </span>
        <button
          onClick={() => router.push('/sitee/tasks')}
          style={{
            background: '#c0c0c0',
            border: '2px outset #fff',
            padding: '2px 8px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          X
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        width: '100%',
        maxWidth: '640px',
        background: '#c0c0c0',
        border: '2px inset #808080',
        padding: '8px',
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        {/* Color palette */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '3px',
          maxWidth: '150px',
        }}>
          {COLORS.map(c => (
            <div
              key={c}
              onClick={() => { setColor(c); setTool('brush') }}
              style={{
                width: '20px',
                height: '20px',
                background: c,
                border: color === c && tool === 'brush' ? '2px solid #ff00ff' : '1px solid #000',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* Brush sizes */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {BRUSH_SIZES.map(size => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              style={{
                width: '30px',
                height: '30px',
                background: brushSize === size ? '#000080' : '#c0c0c0',
                color: brushSize === size ? '#fff' : '#000',
                border: '2px outset #fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{
                width: size,
                height: size,
                background: brushSize === size ? '#fff' : '#000',
                borderRadius: '50%',
              }} />
            </button>
          ))}
        </div>

        {/* Tool buttons */}
        <button
          onClick={() => setTool('brush')}
          style={{
            padding: '5px 10px',
            background: tool === 'brush' ? '#00bfff' : '#c0c0c0',
            border: '2px outset #fff',
            cursor: 'pointer',
            fontFamily: 'Comic Neue, cursive',
          }}
        >
          🖌️ brush
        </button>

        <button
          onClick={() => setTool('fill')}
          style={{
            padding: '5px 10px',
            background: tool === 'fill' ? '#00bfff' : '#c0c0c0',
            border: '2px outset #fff',
            cursor: 'pointer',
            fontFamily: 'Comic Neue, cursive',
          }}
        >
          🪣 fill
        </button>

        <button
          onClick={() => setTool('eraser')}
          style={{
            padding: '5px 10px',
            background: tool === 'eraser' ? '#ff6b9d' : '#c0c0c0',
            border: '2px outset #fff',
            cursor: 'pointer',
            fontFamily: 'Comic Neue, cursive',
          }}
        >
          🧽 eraser
        </button>

        {/* Clear */}
        <button
          onClick={clearCanvas}
          style={{
            padding: '5px 10px',
            background: '#c0c0c0',
            border: '2px outset #fff',
            cursor: 'pointer',
            fontFamily: 'Comic Neue, cursive',
          }}
        >
          🗑️ clear
        </button>
      </div>

      {/* Canvas container - two stacked canvases */}
      <div style={{
        border: '3px inset #808080',
        background: '#fff',
        position: 'relative',
        width: canvasSize,
        height: canvasSize,
      }}>
        {/* Background canvas - savant image */}
        <canvas
          ref={bgCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'block',
          }}
        />
        {/* Drawing canvas - user draws here */}
        <canvas
          ref={drawCanvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: tool === 'eraser' ? 'cell' : tool === 'fill' ? 'pointer' : 'crosshair',
            display: 'block',
            touchAction: 'none',
          }}
        />
      </div>

      {/* Current tool indicator */}
      <div style={{
        marginTop: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span>current:</span>
        <div style={{
          width: '30px',
          height: '30px',
          background: tool === 'eraser' ? '#ffffff' : color,
          border: '2px solid #000',
        }} />
        <span>{tool === 'eraser' ? 'eraser' : tool === 'fill' ? `fill (${color})` : color}</span>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginTop: '15px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <button
          onClick={saveImage}
          style={{
            fontFamily: 'Comic Neue, cursive',
            fontSize: '18px',
            padding: '12px 24px',
            background: '#ffff00',
            border: '3px solid #000',
            cursor: 'pointer',
            boxShadow: '3px 3px 0 #000',
          }}
        >
          💾 save image
        </button>

        <button
          onClick={handleComplete}
          style={{
            fontFamily: 'Comic Neue, cursive',
            fontSize: '18px',
            padding: '12px 24px',
            background: '#00ff00',
            border: '3px solid #000',
            cursor: 'pointer',
            boxShadow: '3px 3px 0 #000',
          }}
        >
          ✅ suhbmet {alreadyCompleted ? '(no more pts)' : '(+200 pts)'}
        </button>
      </div>

      {/* Share prompt modal */}
      {showSharePrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
            padding: '30px',
            border: '5px solid #000',
            boxShadow: '10px 10px 0 #000',
            textAlign: 'center',
            maxWidth: '400px',
          }}>
            <h2 style={{
              fontSize: '32px',
              marginBottom: '15px',
              color: '#fff',
              textShadow: '3px 3px 0 #000',
            }}>
              🎉 masterpiece complete!
            </h2>

            <p style={{
              fontSize: '24px',
              marginBottom: '20px',
              color: pointsEarned > 0 ? '#000' : '#666',
            }}>
              {pointsEarned > 0
                ? `+${pointsEarned} points earned!`
                : 'nice art! (u already got ur points tho)'}
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <button
                onClick={handleShare}
                style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '20px',
                  padding: '15px 30px',
                  background: '#1DA1F2',
                  border: '3px solid #000',
                  cursor: 'pointer',
                  color: '#fff',
                  boxShadow: '4px 4px 0 #000',
                }}
              >
                share on X 🐦
              </button>

              <button
                onClick={copyImage}
                style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '20px',
                  padding: '15px 30px',
                  background: copySuccess ? '#00ff00' : '#ff6b9d',
                  border: '3px solid #000',
                  cursor: 'pointer',
                  boxShadow: '4px 4px 0 #000',
                }}
              >
                {copySuccess ? 'copied! ✅' : 'copy image 📋'}
              </button>

              <button
                onClick={saveImage}
                style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '20px',
                  padding: '15px 30px',
                  background: '#ffff00',
                  border: '3px solid #000',
                  cursor: 'pointer',
                  boxShadow: '4px 4px 0 #000',
                }}
              >
                download image 💾
              </button>

              <button
                onClick={() => router.push('/sitee/tasks')}
                style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '20px',
                  padding: '15px 30px',
                  background: '#00ff00',
                  border: '3px solid #000',
                  cursor: 'pointer',
                  boxShadow: '4px 4px 0 #000',
                }}
              >
                bak 2 tasks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
