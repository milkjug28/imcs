'use client'

import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'

const LAYER_NAMES = ["bg's", 'bods', 'cloths', 'speshul', 'ayezz', 'moufs', 'facessories', 'hatss', 'extruhs', 'textuh']
const LAYER_ORDER = [0, 1, 2, 3, 8, 6, 5, 4, 7, 9]
const REQUIRED_SLOTS = new Set([0, 1, 4])
const LOCKED_SLOTS = new Set([1])

const BOD_MAP: Record<string, string> = {
  'derk': 'derk', 'lyte': 'lyte', 'ayeliun': 'ayeliun',
}

type TraitInfo = {
  traitId: number
  layer: number
  layerName: string
  slot: string
  index: number
  name: string
  filename: string
  rarity: number
  hidden: boolean
}

type EquipmentSlot = {
  slot: number
  slotName: string
  traitId: number
  trait: TraitInfo | null
}

type EquipmentData = {
  tokenId: number
  equipment: EquipmentSlot[]
}

type NewTraitData = {
  id: string
  name: string
  layer: number
  layerName: string
  filename: string
  isNew: true
  sub?: string
  variants?: string[]
}

type DisplayTrait = {
  key: string
  name: string
  traitId: number | null
  imageUrl: string
  isNew: boolean
  isEquipped: boolean
}

function traitImageUrl(trait: TraitInfo): string {
  return `/api/traits/image?layer=${encodeURIComponent(trait.layerName)}&file=${encodeURIComponent(trait.filename)}`
}

function newTraitImageUrl(t: NewTraitData, bodVariant?: string): string {
  if (t.sub && bodVariant) {
    return `/api/traits/image?layer=${encodeURIComponent(t.layerName)}&sub=${encodeURIComponent(t.sub)}&file=${encodeURIComponent(bodVariant + '.png')}&new=1`
  }
  return `/api/traits/image?layer=${encodeURIComponent(t.layerName)}&file=${encodeURIComponent(t.filename)}&new=1`
}

export default function EkwipPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', fontFamily: "'Comic Neue', cursive" }}><h2>loading...</h2></div>}>
      <EkwipPage />
    </Suspense>
  )
}

function EkwipPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { address } = useWallet()
  const tokenId = parseInt(searchParams.get('tokenId') || '')

  const [equipped, setEquipped] = useState<EquipmentData | null>(null)
  const [allTraits, setAllTraits] = useState<Record<number, TraitInfo>>({})
  const [newTraits, setNewTraits] = useState<NewTraitData[]>([])
  const [pendingChanges, setPendingChanges] = useState<Record<number, number>>({})
  const [pendingImages, setPendingImages] = useState<Record<number, string>>({})
  const [activeSlot, setActiveSlot] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [successImage, setSuccessImage] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragImgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!tokenId || isNaN(tokenId)) return
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/traits/equipped?tokenId=${tokenId}`).then(r => r.json()),
      fetch('/api/traits/all').then(r => r.json()),
      fetch('/api/traits/new').then(r => r.json()),
    ])
      .then(([equipData, traitsData, newData]) => {
        if (equipData.error) {
          setError(equipData.error)
          return
        }
        setEquipped(equipData)
        setAllTraits(traitsData.traits || {})
        setNewTraits(newData.traits || [])
      })
      .catch(() => setError('failed to load trait data'))
      .finally(() => setLoading(false))
  }, [tokenId])

  const bodVariant = useMemo(() => {
    if (!equipped) return 'derk'
    const bodTrait = equipped.equipment[1]?.trait
    if (!bodTrait) return 'derk'
    const name = bodTrait.name.toLowerCase()
    if (name.includes('ayeliun') || name.includes('alien')) return 'ayeliun'
    if (name.includes('lyte') || name.includes('lite')) return 'lyte'
    return 'derk'
  }, [equipped])

  const previewSlots = useMemo(() =>
    equipped ? equipped.equipment.map((s, i) =>
      pendingChanges[i] !== undefined ? pendingChanges[i] : s.traitId
    ) : Array(10).fill(0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [equipped, JSON.stringify(pendingChanges)]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    const renderPreview = async () => {
      const images: { idx: number; img: HTMLImageElement }[] = []
      for (const layerIdx of LAYER_ORDER) {
        let src: string | null = null
        if (pendingImages[layerIdx]) {
          src = pendingImages[layerIdx]
        } else {
          const traitId = previewSlots[layerIdx]
          if (traitId === 0) continue
          const trait = allTraits[traitId]
          if (!trait) continue
          src = traitImageUrl(trait)
        }
        if (!src) continue
        try {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = src
          })
          images.push({ idx: layerIdx, img })
        } catch {
          // skip
        }
      }
      if (cancelled) return
      ctx.clearRect(0, 0, 500, 500)
      for (const { img } of images) {
        ctx.drawImage(img, 0, 0, 500, 500)
      }
    }
    renderPreview()
    return () => { cancelled = true }
  }, [previewSlots, allTraits, pendingImages])

  const handleUnequip = (slotIndex: number) => {
    if (REQUIRED_SLOTS.has(slotIndex)) return
    const currentEquipped = equipped?.equipment[slotIndex]?.traitId ?? 0
    if (currentEquipped === 0 && pendingChanges[slotIndex] === undefined) return
    const newImages = { ...pendingImages }
    delete newImages[slotIndex]
    setPendingImages(newImages)
    if (pendingChanges[slotIndex] === 0) {
      const newChanges = { ...pendingChanges }
      delete newChanges[slotIndex]
      setPendingChanges(newChanges)
    } else {
      setPendingChanges({ ...pendingChanges, [slotIndex]: 0 })
    }
  }

  const handleEquip = (slotIndex: number, traitId: number) => {
    const newImages = { ...pendingImages }
    delete newImages[slotIndex]
    setPendingImages(newImages)
    const original = equipped?.equipment[slotIndex]?.traitId ?? 0
    if (traitId === original) {
      const newChanges = { ...pendingChanges }
      delete newChanges[slotIndex]
      setPendingChanges(newChanges)
    } else {
      setPendingChanges({ ...pendingChanges, [slotIndex]: traitId })
    }
  }

  const handleEquipNew = (slotIndex: number, imageUrl: string) => {
    setPendingChanges({ ...pendingChanges, [slotIndex]: -1 })
    setPendingImages({ ...pendingImages, [slotIndex]: imageUrl })
  }

  const handleReset = () => {
    setPendingChanges({})
    setPendingImages({})
  }

  const handleConfirm = () => {
    setConfirming(true)
    const canvas = canvasRef.current
    if (canvas) {
      setSuccessImage(canvas.toDataURL('image/png'))
    }
    setTimeout(() => {
      setConfirming(false)
      setShowSuccess(true)
    }, 1200)
  }

  const handleCloseSuccess = () => {
    setShowSuccess(false)
    setSuccessImage(null)
    setPendingChanges({})
    setPendingImages({})
  }

  const hasChanges = Object.keys(pendingChanges).length > 0

  const displayTraits = useMemo((): DisplayTrait[] => {
    if (!equipped) return []

    if (LOCKED_SLOTS.has(activeSlot)) {
      const t = equipped.equipment[activeSlot]?.trait
      if (!t) return []
      return [{
        key: `own_${t.traitId}`,
        name: t.name,
        traitId: t.traitId,
        imageUrl: traitImageUrl(t),
        isNew: false,
        isEquipped: true,
      }]
    }

    const currentTraitId = pendingChanges[activeSlot] !== undefined
      ? pendingChanges[activeSlot]
      : (equipped.equipment[activeSlot]?.traitId ?? 0)

    const items: DisplayTrait[] = []

    const ownTrait = equipped.equipment[activeSlot]?.trait
    if (ownTrait) {
      items.push({
        key: `own_${ownTrait.traitId}`,
        name: ownTrait.name,
        traitId: ownTrait.traitId,
        imageUrl: traitImageUrl(ownTrait),
        isNew: false,
        isEquipped: ownTrait.traitId === currentTraitId,
      })
    }

    const layerNewTraits = newTraits.filter(t => t.layer === activeSlot)
    const activeImageOverride = pendingImages[activeSlot]
    for (const nt of layerNewTraits) {
      const url = nt.sub ? newTraitImageUrl(nt, bodVariant) : newTraitImageUrl(nt)
      items.push({
        key: nt.id,
        name: nt.name,
        traitId: null,
        imageUrl: url,
        isNew: true,
        isEquipped: activeImageOverride === url,
      })
    }

    return items
  }, [equipped, activeSlot, pendingChanges, pendingImages, newTraits, bodVariant, allTraits])

  const traitImageCache = useRef<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    displayTraits.forEach(t => {
      if (!traitImageCache.current.has(t.key)) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = t.imageUrl
        traitImageCache.current.set(t.key, img)
      }
    })
  }, [displayTraits])

  const handleDragStart = (e: React.DragEvent, dt: DisplayTrait) => {
    const data = dt.traitId !== null
      ? JSON.stringify({ type: 'existing', traitId: dt.traitId })
      : JSON.stringify({ type: 'new', imageUrl: dt.imageUrl, slot: activeSlot })
    e.dataTransfer.setData('text/plain', data)
    const cached = traitImageCache.current.get(dt.key)
    const dragImg = dragImgRef.current
    if (cached && cached.complete && dragImg) {
      const dragCanvas = document.createElement('canvas')
      dragCanvas.width = 280
      dragCanvas.height = 280
      const ctx = dragCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(cached, 0, 0, 280, 280)
        dragImg.src = dragCanvas.toDataURL('image/png')
      }
      e.dataTransfer.setDragImage(dragImg, 140, 140)
    }
  }

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (data.type === 'new') {
        handleEquipNew(data.slot, data.imageUrl)
      } else if (data.type === 'existing') {
        const traitId = data.traitId
        if (!allTraits[traitId]) return
        handleEquip(allTraits[traitId].layer, traitId)
      }
    } catch {
      // ignore
    }
  }

  if (!tokenId || isNaN(tokenId)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: "'Comic Neue', cursive" }}>
        <h2>no savant selected</h2>
        <p>go 2 ur profil and pick a savant 2 ekwip</p>
        <button
          onClick={() => router.push('/sitee/profil')}
          style={{
            marginTop: '16px', padding: '8px 20px',
            background: '#00cc55', border: '3px solid #000',
            borderRadius: '8px', fontFamily: "'Comic Neue', cursive",
            fontWeight: 700, fontSize: '14px', cursor: 'pointer',
            boxShadow: '3px 3px 0 #000',
          }}
        >
          ← bak 2 profil
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: "'Comic Neue', cursive" }}>
        <h2>loading savant #{tokenId}...</h2>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: "'Comic Neue', cursive" }}>
        <h2>error: {error}</h2>
        <button onClick={() => router.push('/sitee/profil')} style={{
          marginTop: '16px', padding: '8px 20px',
          background: '#00cc55', border: '3px solid #000',
          borderRadius: '8px', fontFamily: "'Comic Neue', cursive",
          fontWeight: 700, fontSize: '14px', cursor: 'pointer',
          boxShadow: '3px 3px 0 #000',
        }}>
          ← bak 2 profil
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 20px', fontFamily: "'Comic Neue', cursive", maxWidth: '820px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <button
          onClick={() => router.push('/sitee/profil')}
          style={{
            padding: '4px 12px', background: '#00cc55', border: '2px solid #000',
            borderRadius: '6px', fontFamily: "'Comic Neue', cursive",
            fontWeight: 700, fontSize: '12px', cursor: 'pointer',
            boxShadow: '2px 2px 0 #000',
          }}
        >
          ← bak 2 profil
        </button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
          ekwip savant #{tokenId}
        </h2>
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left: Canvas + buttons */}
        <div style={{ flexShrink: 0, width: '280px' }}>
          <canvas
            ref={canvasRef}
            width={500}
            height={500}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
            style={{
              width: '280px', height: '280px',
              border: '4px solid #00cc88',
              borderRadius: '8px',
              background: '#333',
              boxShadow: '0 0 12px rgba(0, 204, 136, 0.5)',
              cursor: 'pointer',
            }}
          />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={dragImgRef} alt="" style={{ position: 'fixed', top: -9999, left: -9999, width: '280px', height: '280px', pointerEvents: 'none' }} />

          {/* Reset / Confirm buttons */}
          <div style={{ marginTop: '6px', display: 'flex', gap: '8px', justifyContent: 'center', minHeight: '30px' }}>
            {hasChanges && (
              <>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '4px 14px', background: '#cc0000', color: '#fff',
                    border: '2px solid #000', borderRadius: '6px',
                    fontFamily: "'Comic Neue', cursive", fontWeight: 700,
                    fontSize: '12px', cursor: 'pointer', boxShadow: '2px 2px 0 #000',
                  }}
                >
                  reset
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    padding: '4px 14px', background: confirming ? '#999' : '#00cc55', color: '#000',
                    border: '2px solid #000', borderRadius: '6px',
                    fontFamily: "'Comic Neue', cursive", fontWeight: 700,
                    fontSize: '12px', cursor: confirming ? 'wait' : 'pointer', boxShadow: '2px 2px 0 #000',
                  }}
                >
                  {confirming ? 'konfirming...' : `konfirm (${Object.keys(pendingChanges).length} changez)`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Tab bar + trait grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Layer tabs */}
          <div style={{
            display: 'flex', gap: '0', overflowX: 'auto',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            position: 'relative',
            zIndex: 1,
          }}>
            {LAYER_NAMES.map((layerName, slotIndex) => {
              const isActive = activeSlot === slotIndex
              const isChanged = pendingChanges[slotIndex] !== undefined

              return (
                <button
                  key={slotIndex}
                  onClick={() => setActiveSlot(slotIndex)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px', fontWeight: 700,
                    fontFamily: "'Comic Neue', cursive",
                    background: isActive ? '#222' : isChanged ? '#fff' : 'rgba(255,255,255,0.5)',
                    border: isActive ? '2px solid #222' : '2px solid #bbb',
                    borderBottom: isActive ? '2px solid #fff' : '2px solid #000',
                    borderRadius: '6px 6px 0 0',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    color: isActive ? '#fff' : '#333',
                    textDecoration: isChanged ? 'underline' : 'none',
                    textUnderlineOffset: '3px',
                    flexShrink: 0,
                    marginBottom: '-2px',
                    zIndex: isActive ? 3 : 1,
                    position: 'relative',
                  }}
                >
                  {layerName}
                </button>
              )
            })}
          </div>

          {/* Trait grid */}
          <div style={{
            padding: '10px',
            background: '#fff',
            border: '2px solid #000',
            borderRadius: '0 4px 4px 4px',
            minHeight: '120px',
            position: 'relative',
            zIndex: 0,
          }}>
            {displayTraits.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', fontFamily: "'Comic Neue', cursive" }}>
                no traits 4 dis slot
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {displayTraits.map(dt => (
                  <div
                    key={dt.key}
                    draggable={!LOCKED_SLOTS.has(activeSlot)}
                    onDragStart={(e) => handleDragStart(e, dt)}
                    onClick={() => {
                      if (LOCKED_SLOTS.has(activeSlot)) return
                      if (dt.isNew) {
                        handleEquipNew(activeSlot, dt.imageUrl)
                      } else if (dt.traitId === null) {
                        return
                      } else if (dt.isEquipped && !REQUIRED_SLOTS.has(activeSlot)) {
                        handleUnequip(activeSlot)
                      } else {
                        handleEquip(activeSlot, dt.traitId)
                      }
                    }}
                    title={dt.name + (dt.isNew ? ' (new!)' : '')}
                    style={{
                      width: '60px', height: '60px',
                      cursor: LOCKED_SLOTS.has(activeSlot) ? 'default' : 'grab',
                      borderRadius: '5px',
                      border: dt.isEquipped ? '2px solid #00cc88' : dt.isNew ? '2px solid #ff69b4' : '1px solid rgba(0,0,0,0.1)',
                      boxShadow: dt.isEquipped ? '0 0 6px rgba(0,204,136,0.4)' : dt.isNew ? '0 0 4px rgba(255,105,180,0.3)' : 'none',
                      overflow: 'hidden',
                      transition: 'box-shadow 0.2s, border 0.2s',
                      position: 'relative',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={dt.imageUrl}
                      alt={dt.name}
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                    {dt.isNew && (
                      <div style={{
                        position: 'absolute', top: '1px', right: '1px',
                        background: '#ff69b4', color: '#fff',
                        fontSize: '6px', fontWeight: 700, padding: '1px 3px',
                        borderRadius: '2px', lineHeight: '8px',
                      }}>
                        NEW
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={handleCloseSuccess}
        >
          <Confetti />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              border: '4px solid #000',
              borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
              overflow: 'hidden',
              textAlign: 'center',
              maxWidth: '340px',
              width: '100%',
              boxShadow: '10px 10px 0 #000',
              animation: 'modalPop 0.4s ease-out',
            }}
          >
            {successImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={successImage}
                alt="updated savant"
                style={{
                  width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block',
                }}
              />
            )}
            <div style={{ padding: '16px' }}>
              <h2 style={{
                fontFamily: "'Comic Neue', cursive",
                fontSize: '22px', fontWeight: 700,
                color: '#000',
                margin: '0 0 6px',
              }}>
                kungrats!!
              </h2>
              <p style={{
                fontFamily: "'Comic Neue', cursive",
                fontSize: '14px', color: '#333',
                margin: '0 0 12px', lineHeight: 1.4,
              }}>
                u jus updaytid ur savaants trayts!
              </p>
              <button
                onClick={handleCloseSuccess}
                style={{
                  padding: '10px 0', width: '100%',
                  background: '#00cc88', color: '#000',
                  border: '3px solid #000',
                  borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
                  fontFamily: "'Comic Neue', cursive", fontWeight: 700,
                  fontSize: '16px', cursor: 'pointer',
                  boxShadow: '4px 4px 0 #000',
                }}
              >
                noice!
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes modalPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ['#ff69b4', '#00ff99', '#ffdd57', '#ff6b6b', '#48dbfb', '#ff9ff3', '#00cc88', '#fff']
    const items: { left: string; delay: string; duration: string; color: string; size: number; char: string }[] = []
    const chars = ['✨', '🎉', '🔥', '💎', '⭐', '🚀', '■', '●', '▲']
    for (let i = 0; i < 60; i++) {
      items.push({
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 1.5}s`,
        duration: `${2 + Math.random() * 2}s`,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 10 + Math.random() * 18,
        char: chars[Math.floor(Math.random() * chars.length)],
      })
    }
    return items
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            top: '-20px',
            fontSize: `${p.size}px`,
            color: p.color,
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
            textShadow: `0 0 6px ${p.color}`,
          }}
        >
          {p.char}
        </div>
      ))}
    </div>
  )
}
