'use client'

import { ReactNode, useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import MusicPlayer from '@/components/MusicPlayer'

type NavButton = {
  id: string
  label: string
  path: string
  defaultPos: { x: number; y: number }
}

const navButtons: NavButton[] = [
  { id: 'home', label: 'hoem', path: '/site', defaultPos: { x: 50, y: 15 } },
  { id: 'submit', label: 'savaant lissst', path: '/site/submit', defaultPos: { x: 180, y: 15 } },
  { id: 'vote', label: 'aprove r denie', path: '/site/vote', defaultPos: { x: 380, y: 15 } },
  { id: 'leaderboard', label: 'leederbord', path: '/site/leaderboard', defaultPos: { x: 580, y: 15 } },
]

export default function SiteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [draggedBtn, setDraggedBtn] = useState<string | null>(null)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => {
      // Load from localStorage if available
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('navPositions')
        if (saved) {
          try {
            return JSON.parse(saved)
          } catch (e) {
            // If parse fails, use defaults
          }
        }
      }
      // Default positions
      return navButtons.reduce((acc, btn) => {
        acc[btn.id] = btn.defaultPos
        return acc
      }, {} as Record<string, { x: number; y: number }>)
    }
  )
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // Save positions to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('navPositions', JSON.stringify(positions))
    }
  }, [positions])

  const handleMouseDown = (e: React.MouseEvent, btnId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setDraggedBtn(btnId)
    setIsDragging(true)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggedBtn || !isDragging) return

    const nav = document.querySelector('nav')
    if (!nav) return

    const navRect = nav.getBoundingClientRect()

    setPositions(prev => ({
      ...prev,
      [draggedBtn]: {
        x: e.clientX - navRect.left - dragOffset.x,
        y: e.clientY - navRect.top - dragOffset.y
      }
    }))
  }

  const handleMouseUp = () => {
    setDraggedBtn(null)
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, draggedBtn])

  return (
    <div id="main-site">
      {/* Header */}
      <header>
        <h1>imaginary magic crypto savants</h1>
      </header>

      {/* Navigation */}
      <nav>
        {navButtons.map(btn => {
          const isActive = pathname === btn.path
          const pos = positions[btn.id] || btn.defaultPos

          return (
            <button
              key={btn.id}
              className={`nav-btn ${isActive ? 'active' : ''} ${draggedBtn === btn.id ? 'dragging' : ''}`}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                handleMouseDown(e, btn.id)
              }}
              onClick={(e) => {
                if (!isDragging) {
                  router.push(btn.path)
                }
              }}
            >
              {btn.label}
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <div id="content">
        {children}
      </div>

      {/* Footer Marquee */}
      <div className="marquee">
        <div className="marquee-content">
          ✨ walcum to imcs magic ralm! cliq for surprises anywar! we pramis to onli tek ur mani ✨
        </div>
      </div>

      {/* Background Music Player */}
      <MusicPlayer />
    </div>
  )
}
