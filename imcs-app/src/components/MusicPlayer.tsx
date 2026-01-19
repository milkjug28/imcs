'use client'

import { useState, useEffect, useRef } from 'react'

const TRACKS = [
  '/assets/audio/0neo-px.mp3',
  '/assets/audio/DJDave-Airglow(Visualizer).mp3',
  '/assets/audio/NoMana,SUPERDARK-HoldMe.mp3',
  '/assets/audio/crystalsettings.mp3',
]

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    // Shuffle tracks on mount
    const shuffled = [...TRACKS].sort(() => Math.random() - 0.5)

    // Try to auto-play on mount
    const audio = audioRef.current
    if (audio) {
      audio.volume = 0.3 // Set to 30% volume

      // Try to play immediately
      const playPromise = audio.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setHasStarted(true)
          })
          .catch(() => {
            // Auto-play was prevented, wait for user interaction
            console.log('Auto-play prevented, waiting for user interaction')

            // Add click listener to start music on first interaction
            const startMusic = () => {
              audio.play()
              setHasStarted(true)
              document.removeEventListener('click', startMusic)
            }

            document.addEventListener('click', startMusic)
          })
      }
    }
  }, [])

  const handleTrackEnd = () => {
    // Move to next track
    const nextIndex = (currentTrackIndex + 1) % TRACKS.length
    setCurrentTrackIndex(nextIndex)
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={TRACKS[currentTrackIndex]}
        onEnded={handleTrackEnd}
        loop={false}
      />

      {/* Hidden UI - music plays in background */}
      {!hasStarted && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '8px 12px',
          borderRadius: '4px',
          border: '2px solid #fff',
          color: '#fff',
          fontSize: '12px',
          zIndex: 9999,
          pointerEvents: 'none'
        }}>
          🎵 click anywhere to start music
        </div>
      )}
    </>
  )
}
