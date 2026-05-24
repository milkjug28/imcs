'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react'
import { SFX } from '@/lib/sound-effects'
import { useRouter } from 'next/navigation'

type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'

type PackTrait = {
  id: string
  name: string
  layerName: string
  layer: number
  imageUrl: string
  rarity: Rarity
  isNew: boolean
}

type GagType = 'GRAVITY_FALL' | 'MONSTER_STEAL' | 'GLITCH_REVERSE' | 'RUBBER_STRETCH'

type PackState = {
  isRipped: boolean
  ripCount: number
  currentGag: GagType | null
  activeGagState: 'idle' | 'triggered' | 'completed'
  cardsRevealed: PackTrait[]
}

const LAYER_DISPLAY: Record<string, string> = {
  "bg's": 'bakground', bods: 'bodee', cloths: 'cloths', speshul: 'speshul',
  ayezz: 'ayezz', moufs: 'moufs', facessories: 'facessories',
  hatss: 'hatss', extruhs: 'extruhs', textuh: 'textuh',
}

const TRAIT_SUPPLY: Record<string, number> = {
  'peekah suhprize': 12, 'wp98': 12,
  'hoodid': 15, 'rohb ov meemz': 44, 'blasstoyce': 8, 'saaluhmandurr': 12,
  'majishun': 33, 'monies sewt': 33, 'ched': 111,
  'deemon': 55, 'therd aye': 55,
  'beerd': 77, 'raynboh deemon grel': 111,
  'ban hammur': 69, 'explooror staaf': 33, 'spuun': 101,
  'doge': 60, 'nurow leenk': 27,
}

function rarityFromSupply(name: string): Rarity {
  const supply = TRAIT_SUPPLY[name.toLowerCase()] ?? TRAIT_SUPPLY[name] ?? 50
  if (supply <= 12) return 'Legendary'
  if (supply <= 33) return 'Epic'
  if (supply <= 60) return 'Rare'
  return 'Common'
}

function getSupply(name: string): number {
  return TRAIT_SUPPLY[name.toLowerCase()] ?? TRAIT_SUPPLY[name] ?? 50
}

const TRAIT_DESCRIPTIONS: Record<string, string> = {
  'peekah suhprize': 'now u see me now u dont. jk u alwayz see me cuz im lejendary.',
  'wp98': 'bootup ur savant wit dat retro OS swag. clippy not inklooded.',
  'hoodid': 'misteereus n shady. nobodee noes wut lurks undur da hood.',
  'rohb ov meemz': 'wrapt in da finest meemz of our generayshun. stonks.',
  'blasstoyce': 'BOOOOM! da rayrst boom boom in all da land. handl wif cayr.',
  'saaluhmandurr': 'lil firey lizurd frend. do not boop da snoot (ok mayb boop it).',
  'majishun': 'nuthin up my sleev... SIKE! its a rug pull! jk jk.',
  'monies sewt': 'drest 4 suksess. wen lambo? wen u put dis on.',
  'ched': 'just a regulur ched doin ched tings. nuthin speshul but stil kewl.',
  'deemon': 'oooOOOooo spoopy demon fays. scayr ur frenz at da discord meetup.',
  'therd aye': 'c tings otherz cant. liek wich alts r gonna pump.',
  'beerd': 'wize n majestic fayshal hair. stroak it wile u pondr ur next traid.',
  'raynboh deemon grel': 'shes got da vibes AND da colorz. evreewun wants 2 b her.',
  'ban hammur': 'BONK! u hav been band from da chat. no apeel.',
  'explooror staaf': 'for navigaytin da wilds of defi. watsh out 4 rug snayks.',
  'spuun': 'y a spuun? y NOT a spuun. sumtimez simple iz best.',
  'doge': 'much wow. very trayt. so savant. wow.',
  'nurow leenk': 'tinee but powrful chain link. connectin blockz sinse 2021.',
}

const FALLBACK_DESCRIPTIONS = [
  'a mysteerius trayt from da vawlt. nobodee noes its tru powur.',
  'ekwip dis n watsh ur savant IQ go brrrr.',
  'hand krafted by da savant elderz in a seecret labratory.',
  'dis trayt wuz forjd in da depfs of da blockchain.',
  'onlee tru savants undurstand da powur of dis peece.',
  'da othr savants r gona b SO jelus wen dey see dis.',
  'legend sez dis trayt wuz discovurd in a losted wallet.',
  'wear it proudlee. or dont. im a card not ur mom.',
]

function getTraitDescription(name: string): string {
  const desc = TRAIT_DESCRIPTIONS[name.toLowerCase()]
  if (desc) return desc
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return FALLBACK_DESCRIPTIONS[Math.abs(hash) % FALLBACK_DESCRIPTIONS.length]
}

const RARITY_COLORS: Record<Rarity, { bg: string; border: string; text: string; glow: string; cardBg: string }> = {
  Legendary: { bg: 'linear-gradient(90deg, #a855f7, #ec4899, #eab308)', border: '#ec4899', text: '#fff', glow: '0 0 25px rgba(236,72,153,0.6)', cardBg: 'linear-gradient(135deg, #ff6b6b, #feca57, #1dd1a1, #54a0ff, #5f27cd, #ff9ff3)' },
  Epic: { bg: '#9333ea', border: '#7c3aed', text: '#fff', glow: '0 0 18px rgba(168,85,247,0.5)', cardBg: 'linear-gradient(135deg, #7c3aed, #ec4899, #6366f1)' },
  Rare: { bg: '#2563eb', border: '#3b82f6', text: '#fff', glow: '0 0 12px rgba(59,130,246,0.4)', cardBg: '#3b82f6' },
  Common: { bg: '#fef3c7', border: '#92400e', text: '#78350f', glow: 'none', cardBg: '#fde68a' },
}

// ============================================================
// WHITEBOARD CANVAS (full port with toolbar + decorations)
// ============================================================
const MARKER_COLORS = [
  { name: 'Black', color: '#1e1b4b', bg: '#1e1b4b' },
  { name: 'Blue', color: '#2563eb', bg: '#2563eb' },
  { name: 'Pink', color: '#ec4899', bg: '#ec4899' },
  { name: 'Lime', color: '#22c55e', bg: '#22c55e' },
  { name: 'Rainbow', color: 'RAINBOW', bg: 'linear-gradient(90deg, #ef4444, #22c55e, #3b82f6)' },
]

function drawDecorations(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.15)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

  // Sun with sunglasses
  ctx.strokeStyle = '#eab308'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.arc(w - 120, 100, 25, 0, Math.PI * 2)
  ctx.stroke()
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.beginPath()
    ctx.moveTo(w - 120 + Math.cos(a) * 33, 100 + Math.sin(a) * 33)
    ctx.lineTo(w - 120 + Math.cos(a) * 44, 100 + Math.sin(a) * 44)
    ctx.stroke()
  }
  ctx.strokeStyle = '#1e1b4b'
  ctx.fillStyle = '#1e1b4b'
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.arc(w - 130, 95, 6, 0, Math.PI); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.arc(w - 110, 95, 6, 0, Math.PI); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(w - 140, 95); ctx.lineTo(w - 100, 95); ctx.stroke()
  ctx.strokeStyle = '#ec4899'
  ctx.beginPath(); ctx.arc(w - 120, 106, 8, 0.1, Math.PI - 0.1); ctx.stroke()

  // IMCS text
  ctx.strokeStyle = '#3b82f6'
  ctx.font = 'bold 36px "Comic Neue", cursive'
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
  ctx.strokeText('IMCS ★', 80, 120)

  // Pink arrow + GRIP & RIP
  ctx.strokeStyle = '#ec4899'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(w / 2 - 190, h / 2 + 10)
  ctx.quadraticCurveTo(w / 2 - 120, h / 2 - 80, w / 2 - 80, h / 2 - 50)
  ctx.stroke()
  ctx.fillStyle = '#ec4899'
  ctx.beginPath()
  ctx.moveTo(w / 2 - 80, h / 2 - 50)
  ctx.lineTo(w / 2 - 100, h / 2 - 40)
  ctx.lineTo(w / 2 - 85, h / 2 - 65)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ec4899'
  ctx.font = '14px monospace'
  ctx.fillText('GRIPP & RIPP!! 👉', w / 2 - 250, h / 2 + 35)

  // Green scribble clouds at bottom
  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(50, h - 80)
  ctx.quadraticCurveTo(100, h - 120, 150, h - 80)
  ctx.quadraticCurveTo(200, h - 130, 250, h - 80)
  ctx.stroke()

  ctx.restore()
}

function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawingRef = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const rainbowHue = useRef(0)
  const [activeColor, setActiveColor] = useState('#ec4899')
  const [brushWidth, setBrushWidth] = useState(5)
  const [isEraser, setIsEraser] = useState(false)

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const temp = document.createElement('canvas')
      temp.width = canvas.width; temp.height = canvas.height
      const tc = temp.getContext('2d')
      if (tc) tc.drawImage(canvas, 0, 0)
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width; canvas.height = rect.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        ctx.drawImage(temp, 0, 0)
        drawDecorations(ctx, rect.width, rect.height)
      }
    }
    window.addEventListener('resize', resize)
    resize()
    return () => window.removeEventListener('resize', resize)
  }, [])

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      if (e.touches.length === 0) return null
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if ('cancelable' in e && e.cancelable) e.preventDefault()
    const c = getCoords(e)
    if (!c) return
    isDrawingRef.current = true
    lastPos.current = c
    SFX.playScribble()
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return
    if ('cancelable' in e && e.cancelable) e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const c = getCoords(e)
    if (!ctx || !c || !lastPos.current) return
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(c.x, c.y)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = brushWidth * 4
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.lineWidth = brushWidth
      if (activeColor === 'RAINBOW') {
        rainbowHue.current = (rainbowHue.current + 8) % 360
        ctx.strokeStyle = `hsl(${rainbowHue.current}, 90%, 55%)`
      } else {
        ctx.strokeStyle = activeColor
      }
    }
    ctx.stroke()
    if (Math.random() < 0.08) SFX.playScribble()
    lastPos.current = c
  }

  const stopDraw = () => { isDrawingRef.current = false; lastPos.current = null }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawDecorations(ctx, canvas.width, canvas.height)
      SFX.playBoing()
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', userSelect: 'none' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor: 'crosshair', zIndex: 0 }}
      />
      {/* Marker toolbar */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 10,
        background: 'rgba(255,251,235,0.9)', padding: '8px 10px', borderRadius: '12px',
        border: '3px solid rgba(120,53,15,0.6)', display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', gap: '8px', backdropFilter: 'blur(2px)',
      }}>
        <span style={{ color: '#78350f', fontWeight: 700, fontSize: '11px', fontFamily: "'Comic Neue', cursive", display: 'flex', alignItems: 'center', gap: '4px' }}>
          🎨 MARKURS:
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {MARKER_COLORS.map(m => (
            <button
              key={m.name}
              onClick={() => { setActiveColor(m.color); setIsEraser(false); SFX.playScribble() }}
              style={{
                width: '28px', height: '28px', borderRadius: '4px',
                border: activeColor === m.color && !isEraser ? '3px solid #1e1b4b' : '2px solid rgba(0,0,0,0.3)',
                background: m.bg, cursor: 'pointer',
                transform: activeColor === m.color && !isEraser ? 'scale(1.15) translateY(-2px)' : 'none',
                transition: 'transform 0.1s',
              }}
            />
          ))}
        </div>
        <div style={{ height: '24px', width: '1px', background: 'rgba(120,53,15,0.2)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => { setIsEraser(true); SFX.playScribble() }}
            style={{
              padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
              border: '2px solid rgba(120,53,15,0.4)', cursor: 'pointer',
              background: isEraser ? '#78350f' : '#fff', color: isEraser ? '#fff' : '#78350f',
              fontFamily: "'Comic Neue', cursive", display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            🧽 SPUNJ
          </button>
          <button
            onClick={clearCanvas}
            style={{
              padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
              border: '2px solid rgba(120,53,15,0.4)', cursor: 'pointer',
              background: '#fff', color: '#dc2626',
              fontFamily: "'Comic Neue', cursive", display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            🗑️ WAYP
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#78350f', fontWeight: 700 }}>THIKNES:</span>
          <input
            type="range" min={3} max={18} value={brushWidth}
            onChange={(e) => setBrushWidth(Number(e.target.value))}
            style={{ width: '56px', height: '4px', cursor: 'pointer', accentColor: '#78350f' }}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// BOOSTER PACK
// ============================================================
function BoosterPack({ onRip, isStretchedGag, onGagSqueaked }: {
  onRip: () => void
  isStretchedGag: boolean
  onGagSqueaked?: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isRipped, setIsRipped] = useState(false)
  const [gagBoingCount, setGagBoingCount] = useState(0)
  const [ripMethod, setRipMethod] = useState<'ZIPPER' | 'SCISSORS' | 'CHOP'>('ZIPPER')
  const [chopHits, setChopHits] = useState(0)
  const [shakePack, setShakePack] = useState(false)

  const dragY = useMotionValue(0)
  const packScaleY = useTransform(dragY, [0, 200], [1, isStretchedGag ? 1.45 : 1.15])
  const packSkewX = useTransform(dragY, [0, 200], [0, isStretchedGag ? 12 : 0])
  const dragX = useMotionValue(0)

  const triggerRipSuccess = () => {
    if (isStretchedGag && gagBoingCount < 1) {
      SFX.playBoing()
      setGagBoingCount(gagBoingCount + 1)
      onGagSqueaked?.()
      dragY.set(0)
      dragX.set(0)
      setChopHits(0)
    } else {
      setIsRipped(true)
      SFX.playRip()
      SFX.playChime()
      onRip()
    }
  }

  const methodBtnStyle = (active: boolean, color: string) => ({
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
    padding: '6px 8px', fontSize: '11px', fontWeight: 900 as const, borderRadius: '8px',
    border: active ? '2px solid #000' : '2px solid #e5e5e5', cursor: 'pointer',
    background: active ? color : '#fff', color: active ? '#000' : '#888',
    boxShadow: active ? '2px 2px 0 #000' : 'none',
    fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase' as const,
  })

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '340px', transform: 'scale(0.9)', transformOrigin: 'top center' }}>
      {/* Method selector */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '10px', background: '#fff', padding: '6px',
        borderRadius: '12px', border: '3px solid #000', boxShadow: '4px 4px 0 #000', width: '100%', justifyContent: 'space-around', pointerEvents: 'auto' as const,
      }}>
        <button onClick={() => { setRipMethod('ZIPPER'); SFX.playScribble() }} style={methodBtnStyle(ripMethod === 'ZIPPER', '#fde047')}>
          🤐 Zippurr
        </button>
        <button onClick={() => { setRipMethod('SCISSORS'); SFX.playScribble() }} style={methodBtnStyle(ripMethod === 'SCISSORS', '#f9a8d4')}>
          ✂️ Sizzurs
        </button>
        <button onClick={() => { setRipMethod('CHOP'); SFX.playScribble() }} style={methodBtnStyle(ripMethod === 'CHOP', '#6ee7b7')}>
          🥋 Chawp!
        </button>
      </div>

      {/* Pack image */}
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{
          scale: isDragging ? 1.02 : 1,
          y: isRipped ? -20 : 0,
          rotate: shakePack ? [0, -4, 4, -4, 4, 0] : isHovered ? 1 : 0,
        }}
        transition={{ duration: shakePack ? 0.25 : 0.15 }}
        onClick={() => {
          if (ripMethod === 'CHOP') {
            setShakePack(true)
            setTimeout(() => setShakePack(false), 200)
            SFX.playBoing()
            const next = chopHits + 1
            setChopHits(next)
            if (next >= 3) { triggerRipSuccess(); setChopHits(0) }
          }
        }}
        style={{
          position: 'relative', userSelect: 'none', pointerEvents: 'auto',
          cursor: ripMethod === 'CHOP' ? 'pointer' : 'default',
          scaleY: ripMethod === 'ZIPPER' ? packScaleY : 1,
          skewX: ripMethod === 'ZIPPER' ? packSkewX : 0,
        }}
      >
        <img
          src="/assets/card-pack.png"
          alt="IMCS Trait Booster Pack"
          style={{ width: '260px', height: 'auto', display: 'block', filter: 'drop-shadow(8px 8px 0 rgba(0,0,0,0.35))' }}
          draggable={false}
        />

        {/* Tape stickers */}
        <div style={{
          position: 'absolute', bottom: '14px', left: '-6px', pointerEvents: 'none',
          background: '#fef9c3', color: '#78350f', fontSize: '9px', fontWeight: 900,
          border: '2px solid #000', padding: '3px 6px', transform: 'rotate(-8deg)',
          zIndex: 10, fontFamily: 'monospace', boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
        }}>
          SEEREES 1
        </div>
        <div style={{
          position: 'absolute', bottom: '18px', right: '-8px', pointerEvents: 'none',
          background: '#fce7f3', color: '#831843', fontSize: '9px', fontWeight: 900,
          border: '2px solid #000', padding: '3px 6px', transform: 'rotate(10deg)',
          zIndex: 10, fontFamily: 'monospace', boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
        }}>
          SAVANT SZN
        </div>

        {/* Chop hit counter overlay */}
        {ripMethod === 'CHOP' && (
          <div style={{
            position: 'absolute', bottom: '18%', left: 0, right: 0,
            display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 10,
          }}>
            <div style={{
              background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '6px 14px',
              borderRadius: '10px', fontFamily: 'monospace', fontWeight: 900, fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              💥 {chopHits}/3 CHAWPS
            </div>
          </div>
        )}

        {/* Zipper pull handle - overlaid on pack */}
        {ripMethod === 'ZIPPER' && (
          <div style={{
            position: 'absolute', bottom: '10%', left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10,
          }}>
            <div style={{ position: 'relative', height: '80px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '6px', height: '100%', background: 'rgba(255,255,255,0.4)', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.6)' }} />
              <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 120 }}
                dragElastic={isStretchedGag ? 0.65 : 0.15}
                style={{ y: dragY, position: 'absolute', top: 0, pointerEvents: 'auto' }}
                onDragStart={() => { setIsDragging(true); SFX.playScribble() }}
                onDragEnd={(_, info) => {
                  setIsDragging(false)
                  if (info.offset.y > 80) { triggerRipSuccess() } else { dragY.set(0) }
                }}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px',
                  background: '#fffbeb', cursor: 'grab', border: '3px solid #78350f',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
                }}>
                  <span style={{ fontSize: '16px' }}>👇</span>
                  <span style={{ fontSize: '7px', fontFamily: 'monospace', fontWeight: 700, color: '#78350f' }}>YANK</span>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Scissors slider - overlaid on pack */}
        {ripMethod === 'SCISSORS' && (
          <div style={{
            position: 'absolute', left: '12%', right: '12%', top: '50%',
            transform: 'translateY(-50%)', zIndex: 10,
          }}>
            <div style={{
              width: '100%', height: '36px', background: 'rgba(255,255,255,0.75)',
              border: '3px solid #000', borderRadius: '18px', position: 'relative',
              display: 'flex', alignItems: 'center', backdropFilter: 'blur(4px)',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
            }}>
              <div style={{ position: 'absolute', left: '20px', right: '20px', height: '2px', borderTop: '2px dashed rgba(0,0,0,0.3)' }} />
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 130 }}
                style={{ x: dragX, pointerEvents: 'auto' }}
                onDragStart={() => { setIsDragging(true); SFX.playScribble() }}
                onDragEnd={(_, info) => {
                  setIsDragging(false)
                  if (info.offset.x > 90) { triggerRipSuccess() } else { dragX.set(0) }
                }}
              >
                <div style={{
                  marginLeft: '4px', width: '44px', height: '28px', borderRadius: '14px',
                  background: '#fce7f3', border: '2px solid #000', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'grab', boxShadow: '2px 2px 0 rgba(0,0,0,0.2)', fontSize: '18px',
                }}>
                  ✂️
                </div>
              </motion.div>
              <div style={{ position: 'absolute', right: '6px', top: '6px', bottom: '6px', width: '4px', background: '#e11d48', borderRadius: '2px' }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 900, textTransform: 'uppercase', color: '#fff', textShadow: '1px 1px 2px #000, -1px -1px 2px #000' }}>
                ✂️ SLYDE 2 SNIPP
              </span>
            </div>
          </div>
        )}

        {/* Stretch gag warning */}
        {isStretchedGag && gagBoingCount > 0 && (
          <div style={{ position: 'absolute', top: '-40px', left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
            <span style={{ background: '#ef4444', color: '#fff', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, padding: '6px 12px', borderRadius: '9999px', border: '2px solid #fff', textTransform: 'uppercase' }}>
              🤪 STRETCHY BOI! tri agen dummi.
            </span>
          </div>
        )}
      </motion.div>

      {/* Direct rip button */}
      <button
        onClick={() => triggerRipSuccess()}
        style={{
          marginTop: '8px', fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase',
          fontWeight: 900, fontSize: '13px', background: '#fde047', border: '3px solid #000',
          padding: '8px 20px', borderRadius: '14px', cursor: 'pointer', pointerEvents: 'auto',
          boxShadow: '4px 4px 0 #000', display: 'flex', alignItems: 'center', gap: '6px',
        }}
      >
        🔥 JUST RIP IT ALREDY!
      </button>
    </div>
  )
}

// ============================================================
// TRAIT CARD - ported from doodle-pack-ripper DoodleCard
// ============================================================

function TraitCard({ trait, index, isGlitchReverse = false }: {
  trait: PackTrait
  index: number
  isGlitchReverse?: boolean
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFlipped, setIsFlipped] = useState(!isGlitchReverse)
  const [rubCount, setRubCount] = useState(0)
  const rc = RARITY_COLORS[trait.rarity]
  const isSpecial = trait.rarity === 'Legendary' || trait.rarity === 'Epic'

  const CARD_COLORS = ['#c0392b', '#27ae60', '#2980b9']
  const cardBg = isSpecial
    ? 'linear-gradient(135deg, #ff6b6b, #feca57, #1dd1a1, #54a0ff, #5f27cd, #ff9ff3)'
    : CARD_COLORS[index % 3]

  useEffect(() => { SFX.playCardPop(index) }, [index])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    setCoords({ x: x * 15, y: -y * 15 })
  }

  const rarityLabel = { Common: 'commun', Rare: 'rayr', Epic: 'epik', Legendary: 'lejendary' }[trait.rarity]

  const rarityBadgeStyle = (() => {
    switch (trait.rarity) {
      case 'Legendary': return { background: 'linear-gradient(90deg, #a855f7, #ec4899, #eab308)', color: '#fff', fontWeight: 900 as const, border: '2px solid #78350f' }
      case 'Epic': return { background: '#9333ea', color: '#fff', fontWeight: 700 as const, border: '2px solid #78350f' }
      case 'Rare': return { background: '#2563eb', color: '#fff', fontWeight: 600 as const, border: '2px solid #78350f' }
      default: return { background: '#fef3c7', color: '#451a03', fontWeight: 500 as const, border: '1px solid rgba(120,53,15,0.6)' }
    }
  })()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4, y: 70, rotate: -15 + index * 12 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotate: 0, transition: { type: 'spring', damping: 11, stiffness: 90, delay: index * 0.15 } }}
      style={{ position: 'relative', width: '210px', userSelect: 'none', perspective: '1000px' }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => { setIsHovered(true); if (Math.random() < 0.4) SFX.playScribble() }}
        onMouseLeave={() => { setIsHovered(false); setCoords({ x: 0, y: 0 }) }}
        onClick={() => {
          if (isGlitchReverse && !isFlipped) {
            SFX.playScribble()
            const next = rubCount + 1
            setRubCount(next)
            if (next >= 6) { setIsFlipped(true); SFX.playChime() }
          }
        }}
        style={{
          width: '100%', height: 'auto',
          borderRadius: '12px 4px 14px 6px / 4px 14px 6px 12px',
          padding: '14px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          border: '4px solid #000',
          cursor: 'pointer',
          background: cardBg,
          transform: isHovered
            ? `rotateX(${coords.y}deg) rotateY(${coords.x}deg) scale(1.05) translateZ(10px)`
            : 'rotateX(0deg) rotateY(0deg) scale(1) translateZ(0px)',
          boxShadow: isHovered ? '12px 12px 0 rgba(0,0,0,1)' : '6px 6px 0 rgba(0,0,0,1)',
          transition: 'transform 0.1s, box-shadow 0.2s',
          position: 'relative',
        }}
      >
        {/* Holo foil for epic/legendary */}
        {isSpecial && isHovered && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 10,
            mixBlendMode: 'color-dodge', opacity: 0.55,
            background: `linear-gradient(${135 + coords.x * 2}deg, rgba(255,0,0,0.4) 0%, rgba(0,255,0,0.4) 20%, rgba(0,0,255,0.4) 40%, rgba(236,72,153,0.4) 60%, rgba(234,179,8,0.4) 80%, rgba(255,0,0,0.4) 100%)`,
            backgroundSize: '200% 200%',
            backgroundPosition: `${50 + coords.x * 3}% ${50 + coords.y * 3}%`,
          }} />
        )}

        {/* Glitch reverse overlay */}
        {isGlitchReverse && !isFlipped && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', background: '#be9e7a',
            backgroundImage: 'radial-gradient(#ab8966 20%, transparent 20%)', backgroundSize: '16px 16px',
            border: '2px dashed #78350f', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '12px', textAlign: 'center', zIndex: 20,
          }}>
            {/* Masking tape strip */}
            <div style={{
              position: 'absolute', top: '8px', left: '24px', right: '24px', height: '24px',
              background: 'rgba(226,232,240,0.9)', border: '1px solid #cbd5e1',
              transform: 'rotate(-2deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace', fontSize: '9px', color: '#475569', fontWeight: 900,
            }}>
              ░░░ STUK WIF MAYSKN TAYP ░░░
            </div>
            <div style={{
              background: '#fffbeb', border: '2px dashed rgba(120,53,15,0.6)', padding: '16px',
              borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transform: 'rotate(3deg)',
            }}>
              <span style={{ fontFamily: "'Comic Neue', cursive", fontSize: '14px', fontWeight: 900, color: '#78350f' }}>UPSYDE DOWNN!</span>
              <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#78350f' }}>stuk in cardborad gloo!</p>
              <p style={{ fontSize: '10px', background: '#78350f', color: '#fff', fontFamily: 'monospace', padding: '4px 6px', borderRadius: '2px' }}>
                👉 CLIK {6 - rubCount}x 2 PEEL!
              </p>
            </div>
            <div style={{
              position: 'absolute', bottom: '12px', fontSize: '9px', background: '#fee2e2',
              color: '#991b1b', border: '1px solid #fca5a5', fontWeight: 700, padding: '2px 8px',
              borderRadius: '9999px',
            }}>
              GAG #3: GLITCH PAK
            </div>
          </div>
        )}

        {/* === FRONT OF CARD === */}

        {/* Header - masking tape label */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '100%', background: '#fcf8e3', border: '2px solid #000',
            padding: '6px 10px', transform: 'rotate(-2deg) translateY(-4px)',
            borderRadius: '4px 8px 3px 6px',
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(230,220,180,0.15) 0px, rgba(230,220,180,0.15) 4px, transparent 4px, transparent 8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              color: '#451a03', fontWeight: 800, fontSize: '13px', letterSpacing: '-0.025em',
              fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {trait.name}
            </span>
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', fontWeight: 700,
              background: '#451a03', color: '#fffbeb', padding: '1px 4px',
              borderRadius: '2px', textTransform: 'uppercase', flexShrink: 0, marginLeft: '6px',
            }}>
              {LAYER_DISPLAY[trait.layerName] || trait.layerName}
            </span>
          </div>
          {/* Sparkle sticker */}
          <div style={{ position: 'absolute', top: '-14px', right: '-4px', fontSize: '16px' }}>✨</div>
        </div>

        {/* Illustration viewport - SQUARE image area */}
        <div style={{
          margin: '8px 0', padding: '8px', background: '#fcf9f2',
          borderRadius: '10px 4px 12px 6px / 4px 10px 6px 12px',
          border: '2px dashed rgba(69,26,3,0.4)',
          aspectRatio: '1', width: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* IMCS watermark */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.08, pointerEvents: 'none',
            fontFamily: 'monospace', fontSize: '52px', fontWeight: 700, color: '#18181b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            IMCS
          </div>

          {/* Trait image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trait.imageUrl}
            alt={trait.name}
            style={{
              maxWidth: '80%', maxHeight: '80%', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.15))',
              transition: 'transform 0.2s',
              transform: isHovered ? 'scale(1.1)' : 'scale(1)',
            }}
          />

          {/* Corner sticker badges */}
          <div style={{
            position: 'absolute', bottom: '6px', left: '6px',
            background: '#fce7f3', color: '#9f1239', fontFamily: 'monospace',
            fontSize: '8px', fontWeight: 900, letterSpacing: '-0.025em',
            border: '1px solid rgba(159,18,57,0.4)', padding: '1px 4px',
            borderRadius: '2px', transform: 'rotate(-12deg)',
            display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            🔥 CHRY
          </div>
          <div style={{
            position: 'absolute', bottom: '6px', right: '6px',
            background: '#cffafe', color: '#155e75', fontFamily: 'monospace',
            fontSize: '8px', fontWeight: 900, letterSpacing: '-0.025em',
            border: '1px solid rgba(21,94,117,0.4)', padding: '1px 4px',
            borderRadius: '2px', transform: 'rotate(6deg)',
            display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            🏆 INT
          </div>
        </div>

        {/* Bottom stats section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
          {/* Rarity + ID row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: '10px', padding: '2px 10px', borderRadius: '9999px',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              fontFamily: "'Comic Neue', cursive",
              ...rarityBadgeStyle,
            }}>
              ⚙️ {rarityLabel}
            </span>
            <span style={{
              fontSize: '10px', fontFamily: 'monospace', color: '#78350f', fontWeight: 800,
              background: '#fcf8e3', padding: '1px 6px',
              border: '1px dashed rgba(120,53,15,0.3)', borderRadius: '2px',
            }}>
              #{String(getSupply(trait.name)).padStart(5, '0')}
            </span>
          </div>

          {/* Description */}
          <p style={{
            fontSize: '10px', fontWeight: 500, color: '#451a03',
            fontFamily: "'Comic Neue', cursive", letterSpacing: '-0.025em',
            lineHeight: 1.3, marginTop: '4px', fontStyle: 'italic',
          }}>
            &quot;{getTraitDescription(trait.name)}&quot;
          </p>

          {/* Trivia footer */}
          <div style={{
            marginTop: '4px', background: 'rgba(69,26,3,0.05)',
            borderTop: '1px solid rgba(69,26,3,0.15)', paddingTop: '6px',
            fontSize: '9px', fontFamily: 'monospace', color: 'rgba(120,53,15,0.8)',
            lineHeight: 1.3,
          }}>
            <span style={{ fontWeight: 700, color: '#451a03' }}>TRIVIA:</span> supplai of {getSupply(trait.name)} in da collekshun. {trait.rarity === 'Legendary' ? 'super rayr!!' : trait.rarity === 'Epic' ? 'preetty rayr!' : trait.rarity === 'Rare' ? 'sumwut rayr.' : 'preetty commun.'}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function RipPage() {
  const router = useRouter()
  const [traitPool, setTraitPool] = useState<PackTrait[]>([])
  const [loading, setLoading] = useState(true)
  const [soundMuted, setSoundMuted] = useState(false)

  const [packState, setPackState] = useState<PackState>({
    isRipped: false,
    ripCount: 0,
    currentGag: null,
    activeGagState: 'idle',
    cardsRevealed: [],
  })

  useEffect(() => {
    fetch('/api/traits/new')
      .then(r => r.json())
      .then(data => {
        const traits = (data.traits || []).map((t: { id: string; name: string; layer: number; layerName: string; filename: string; sub?: string; variants?: string[] }) => {
          let imageUrl: string
          if (t.sub && t.variants && t.variants.length > 0) {
            const variant = t.variants[0]
            imageUrl = `/api/traits/image?layer=${encodeURIComponent(t.layerName)}&sub=${encodeURIComponent(t.sub)}&file=${encodeURIComponent(variant + '.png')}&new=1`
          } else {
            imageUrl = `/api/traits/image?layer=${encodeURIComponent(t.layerName)}&file=${encodeURIComponent(t.filename)}&new=1`
          }
          return {
            id: t.id,
            name: t.name,
            layerName: t.layerName,
            layer: t.layer,
            imageUrl,
            rarity: rarityFromSupply(t.name),
            isNew: true,
          } as PackTrait
        })
        setTraitPool(traits)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getRandomTraits = useCallback((count: number): PackTrait[] => {
    if (traitPool.length === 0) return []
    const picked: PackTrait[] = []
    const remaining = [...traitPool]
    for (let i = 0; i < Math.min(count, remaining.length); i++) {
      const totalWeight = remaining.reduce((sum, t) => sum + getSupply(t.name), 0)
      let r = Math.random() * totalWeight
      let idx = 0
      for (let j = 0; j < remaining.length; j++) {
        r -= getSupply(remaining[j].name)
        if (r <= 0) { idx = j; break }
      }
      picked.push(remaining[idx])
      remaining.splice(idx, 1)
    }
    return picked
  }, [traitPool])

  const nextGagOverride = useMemo<GagType | 'NONE' | 'RANDOM'>(() => 'RANDOM', [])

  const handlePackRip = () => {
    const nextRipCount = packState.ripCount + 1
    let selectedGag: GagType | null = null

    if (nextGagOverride === 'RANDOM' && nextRipCount === 1) {
      const allGags: GagType[] = ['GRAVITY_FALL', 'MONSTER_STEAL', 'RUBBER_STRETCH', 'GLITCH_REVERSE']
      selectedGag = allGags[Math.floor(Math.random() * allGags.length)]
    }

    const freshTraits = getRandomTraits(3)

    setPackState({
      isRipped: true,
      ripCount: nextRipCount,
      currentGag: selectedGag,
      activeGagState: selectedGag ? 'triggered' : 'completed',
      cardsRevealed: freshTraits,
    })

    if (selectedGag === 'GRAVITY_FALL') {
      SFX.playSlideWhistle(false)
    } else if (selectedGag === 'MONSTER_STEAL') {
      setTimeout(() => SFX.playCheekyMonster(), 700)
    } else if (!selectedGag) {
      SFX.playChime()
    }
  }

  const handleResetPack = () => {
    setPackState(prev => ({
      ...prev,
      isRipped: false,
      currentGag: null,
      activeGagState: 'idle',
      cardsRevealed: [],
    }))
    SFX.playBoing()
  }

  const handleSkipGag = () => {
    const freshTraits = packState.cardsRevealed.length > 0 ? packState.cardsRevealed : getRandomTraits(3)
    setPackState(prev => ({
      ...prev,
      currentGag: null,
      activeGagState: 'completed',
      cardsRevealed: freshTraits,
    }))
    SFX.playChime()
  }

  const toggleSound = () => {
    const next = !soundMuted
    setSoundMuted(next)
    SFX.setMute(next)
    if (!next) SFX.playScribble()
  }

  const gagBtnStyle = (bg: string, color: string) => ({
    background: bg, color, border: '2px solid #78350f', padding: '4px 10px',
    fontSize: '10px', fontWeight: 900 as const, borderRadius: '8px', cursor: 'pointer',
    fontFamily: "'Comic Neue', cursive",
  })

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: "'Comic Neue', cursive" }}>
        <h2>lodin trayt paks...</h2>
      </div>
    )
  }

  return (
    <div style={{
      position: 'relative', minHeight: '80vh', width: '100%', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: "'Comic Neue', cursive",
      backgroundColor: '#fdfdf5',
      backgroundImage: 'radial-gradient(#e5e5f7 1px, transparent 1px), radial-gradient(#e5e5f7 1px, #fdfdf5 1px)',
      backgroundSize: '24px 24px',
    }}>
      <Whiteboard />

      {/* Sound toggle */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 20, pointerEvents: 'auto' }}>
        <button onClick={toggleSound} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
          borderRadius: '12px', border: '3px solid #000', fontSize: '11px', fontWeight: 900,
          cursor: 'pointer', boxShadow: '3px 3px 0 #000',
          background: soundMuted ? '#fecdd3' : '#fff', color: soundMuted ? '#881337' : '#000',
          fontFamily: "'Comic Neue', cursive",
        }}>
          {soundMuted ? '🔇 SHHHH' : '🔊 NOYZES'}
        </button>
      </div>

      {/* Title */}
      <div style={{
        width: '100%', maxWidth: '640px', margin: '16px auto 0', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        userSelect: 'none', zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-2px', marginBottom: '6px', transform: 'rotate(-1deg)', lineHeight: 1.1 }}>
          <span style={{ color: '#ff6b6b' }}>P</span>
          <span style={{ color: '#feca57' }}>A</span>
          <span style={{ color: '#1dd1a1' }}>K</span>
          <span style={{ color: '#54a0ff' }}> </span>
          <span style={{ color: '#5f27cd' }}>R</span>
          <span style={{ color: '#ff9ff3' }}>I</span>
          <span style={{ color: '#ff6b6b' }}>P</span>
          <span style={{ color: '#feca57' }}>P</span>
          <span style={{ color: '#1dd1a1' }}>U</span>
          <span style={{ color: '#54a0ff' }}>R</span>
        </div>

        {packState.isRipped ? (
          <p style={{ fontSize: '12px', background: '#fef08a', color: '#000', padding: '6px 16px', border: '2px dashed #000', transform: 'rotate(1deg)', fontWeight: 700 }}>
            🤪 OOPSEE! i rippd it 2 hard!!!
          </p>
        ) : (
          <p style={{ fontSize: '11px', fontWeight: 700, background: '#fef9c3', color: '#78350f', padding: '4px 12px', border: '2px dashed #000', transform: 'rotate(1.5deg)' }}>
            grab da handl n drag down or tap belo 2 start!
          </p>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px',
          fontFamily: 'monospace', fontSize: '10px', color: '#78350f',
          background: 'rgba(255,251,235,0.9)', padding: '6px 16px', border: '2px solid #000',
          boxShadow: '2px 2px 0 #000',
        }}>
          <span>PAKS RIPPD: <strong style={{ color: '#db2777', fontSize: '12px' }}>{packState.ripCount}</strong></span>
        </div>
      </div>

      {/* Main stage */}
      <div style={{
        width: '100%', maxWidth: '900px', flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '8px 8px',
        margin: '0 auto', zIndex: 10, pointerEvents: 'none',
      }}>
        <AnimatePresence mode="wait">
          {!packState.isRipped ? (
            <motion.div
              key="idle-pack"
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', damping: 15 }}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', pointerEvents: 'auto' }}
            >
              <BoosterPack
                onRip={handlePackRip}
                isStretchedGag={packState.currentGag === 'RUBBER_STRETCH' || (nextGagOverride === 'RANDOM' && packState.ripCount === 0)}
                onGagSqueaked={() => SFX.playSlideWhistle(true)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="ripped-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', pointerEvents: 'auto' }}
            >
              {/* GRAVITY FALL GAG */}
              {packState.currentGag === 'GRAVITY_FALL' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <motion.div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', padding: '24px' }}
                    animate={{ y: [0, 10, 480], rotate: [0, 8, 45], opacity: [1, 1, 0] }}
                    transition={{ duration: 1.8, times: [0, 0.25, 1], ease: 'easeIn', delay: 0.5 }}
                  >
                    {packState.cardsRevealed.map((t, i) => <TraitCard key={t.id} trait={t} index={i} />)}
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0, rotate: -6 }}
                    animate={{ scale: 1, rotate: -2 }}
                    transition={{ type: 'spring', delay: 1.8 }}
                    style={{
                      background: '#ef4444', color: '#fff', fontFamily: 'monospace', padding: '16px',
                      borderRadius: '12px', border: '3px solid #78350f', textAlign: 'center', maxWidth: '320px', marginTop: '16px',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>🛑</span>
                    <h4 style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase' }}>GRAVITEE SPIL!</h4>
                    <p style={{ fontSize: '10.5px', marginTop: '4px', color: '#fee2e2' }}>cardz fell thru da desk flor!</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                      <button onClick={handleSkipGag} style={gagBtnStyle('#fff', '#7f1d1d')}>PEEL BAKUP CARDZ</button>
                      <button onClick={handleResetPack} style={gagBtnStyle('#facc15', '#78350f')}>TRI AGEN</button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* MONSTER STEAL GAG */}
              {packState.currentGag === 'MONSTER_STEAL' && (
                <div style={{ position: 'relative', width: '100%', minHeight: '440px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
                    {packState.cardsRevealed.slice(1).map((t, i) => <TraitCard key={t.id} trait={t} index={i} />)}
                  </div>
                  <motion.div
                    style={{ position: 'absolute', left: 0, bottom: '40px', zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}
                    animate={{ x: [-300, 180, 180, 950], y: [0, -10, -10, 50], rotate: [0, 8, -5, 12] }}
                    transition={{ duration: 3.5, times: [0, 0.4, 0.7, 1], ease: 'easeInOut' }}
                  >
                    <svg viewBox="0 0 100 100" style={{ width: '96px', height: '96px', stroke: '#db2777', fill: '#fce7f3' }} strokeWidth={4}>
                      <path d="M 20 50 Q 15 30 50 20 Q 85 10 80 50 Q 85 85 50 80 Q 20 85 20 50 Z" />
                      <circle cx="35" cy="40" r="6" fill="#1e1b4b" />
                      <circle cx="65" cy="42" r="8" fill="#1e1b4b" />
                      <line x1="61" y1="42" x2="69" y2="42" stroke="white" strokeWidth={2} />
                      <path d="M 30 65 Q 48 78 70 60" fill="none" strokeWidth={4} strokeLinecap="round" />
                      <path d="M 78 55 Q 110 40 135 60 Q 110 70 78 60" fill="none" strokeWidth={5} />
                    </svg>
                    <div style={{ background: '#fffbeb', border: '2px solid #78350f', padding: '4px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '6px', transform: 'rotate(-6deg)', color: '#db2777', marginTop: '4px' }}>
                      &quot;YOINK! MYNE!&quot; 😈
                    </div>
                  </motion.div>
                  <div style={{
                    background: '#fffbeb', border: '3px solid #78350f', padding: '16px', borderRadius: '12px',
                    maxWidth: '320px', marginTop: '24px', textAlign: 'center', transform: 'rotate(1deg)', zIndex: 10,
                  }}>
                    <span style={{ fontSize: '20px' }}>👾</span>
                    <h4 style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: '#db2777' }}>BLOBBY SNATCHED ONE!</h4>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                      <button onClick={handleSkipGag} style={gagBtnStyle('#10b981', '#fff')}>FLIP EM BAK</button>
                      <button onClick={handleResetPack} style={gagBtnStyle('#facc15', '#78350f')}>TRI AGEN</button>
                    </div>
                  </div>
                </div>
              )}

              {/* GLITCH REVERSE GAG */}
              {packState.currentGag === 'GLITCH_REVERSE' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                    {packState.cardsRevealed.map((t, i) => <TraitCard key={t.id} trait={t} index={i} isGlitchReverse />)}
                  </div>
                  <div style={{
                    background: 'rgba(255,251,235,0.9)', border: '3px solid #78350f', padding: '16px',
                    borderRadius: '12px', textAlign: 'center', maxWidth: '320px',
                  }}>
                    <span style={{ fontSize: '20px' }}>👑</span>
                    <h4 style={{ fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>PACKING TAPE GLUE FAIL</h4>
                    <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#78350f', marginTop: '4px' }}>
                      Click each card 6x to peel the tape!
                    </p>
                    <button onClick={handleSkipGag} style={{ ...gagBtnStyle('#2563eb', '#fff'), marginTop: '8px' }}>
                      FORCE UNPEEL ALL
                    </button>
                  </div>
                </div>
              )}

              {/* CLEAN REVEAL */}
              {!packState.currentGag && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                  <div style={{ position: 'absolute', top: '40px', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '24px', userSelect: 'none' }}>
                      <span>✨</span><span>🌟</span><span>⭐</span><span>🎨</span><span>💖</span><span>🎉</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                    {packState.cardsRevealed.map((t, i) => <TraitCard key={t.id} trait={t} index={i} />)}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                    <button
                      onClick={handleResetPack}
                      style={{
                        fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900,
                        color: '#78350f', background: '#6ee7b7', border: '3px solid #78350f',
                        padding: '12px 28px', borderRadius: '16px', cursor: 'pointer',
                        boxShadow: '4px 4px 0 #1e1b4b', fontSize: '14px',
                      }}
                    >
                      🛒 GRAB ANUTHER PAK
                    </button>
                    <button
                      onClick={() => router.push('/sitee/profil')}
                      style={{
                        fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900,
                        color: '#000', background: '#00cc88', border: '3px solid #000',
                        padding: '12px 28px', borderRadius: '16px', cursor: 'pointer',
                        boxShadow: '4px 4px 0 #000', fontSize: '14px',
                      }}
                    >
                      ⚡ GO EKWIP UR TRAYTS!
                    </button>
                  </div>

                  <span style={{
                    fontSize: '11px', background: '#fffbeb', border: '2px dashed rgba(120,53,15,0.6)',
                    padding: '8px 12px', color: '#78350f', fontFamily: 'monospace', fontWeight: 700,
                    transform: 'rotate(2deg)',
                  }}>
                    🎉 SUKSESS! trayts unlokd!
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{
        marginBottom: '8px', fontSize: '10px', fontFamily: 'monospace',
        color: 'rgba(120,53,15,0.6)', fontWeight: 600, pointerEvents: 'none',
        userSelect: 'none', zIndex: 10, textAlign: 'center',
      }}>
        IMCS NFT Krafting Stayshun v1.42
      </div>
    </div>
  )
}
