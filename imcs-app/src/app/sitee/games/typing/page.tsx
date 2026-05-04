'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import TypingTest from '@/components/gates/TypingTest'
import SharePrompt from '@/components/SharePrompt'

const MAX_ATTEMPTS = 5

export default function TypingGamePage() {
  const router = useRouter()
  const { address } = useWallet()
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [wpm, setWpm] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [maxReached, setMaxReached] = useState(false)
  const [pointsAdded, setPointsAdded] = useState(0)

  // Fetch current attempt count on mount
  useEffect(() => {
    const fetchAttempts = async () => {
      if (!address) return
      try {
        const res = await fetch(`/api/tasks/${address}`)
        if (res.ok) {
          const data = await res.json()
          const typingTask = data.tasks?.find((t: any) => t.task_type === 'typing')
          if (typingTask) {
            const count = typingTask.completion_count || 1
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

  const handleSuccess = async (earnedScore: number, earnedWpm: number) => {
    setScore(earnedScore)
    setWpm(earnedWpm)

    // Save to task completions
    if (address) {
      try {
        const response = await fetch('/api/tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: address,
            task_type: 'typing',
            score: earnedScore,
          }),
        })
        const result = await response.json()

        if (result.max_reached) {
          setMaxReached(true)
          setPointsAdded(0)
        } else if (result.success) {
          setAttemptsLeft(result.attempts_left ?? null)
          // Use the points that were actually added (from API response or fallback to earnedScore)
          setPointsAdded(result.added !== undefined ? result.added : earnedScore)
        } else {
          // If API failed but we have a score, still show it
          setPointsAdded(earnedScore)
        }
      } catch (e) {
        console.error('Failed to save score:', e)
        // If save failed, still show the earned score
        setPointsAdded(earnedScore)
      }
    } else {
      // No wallet but still show score
      setPointsAdded(earnedScore)
    }

    setShowResult(true)
  }

  const handlePlayAgain = () => {
    setShowResult(false)
    setScore(0)
    setWpm(0)
    setPointsAdded(0)
  }

  if (showResult) {
    const getScoreLabel = () => {
      if (maxReached) return 'max attempts reached (no more points)'
      // Use pointsAdded if available, otherwise use score (which should be the earned points)
      const displayPoints = pointsAdded > 0 ? pointsAdded : score
      if (displayPoints > 0) {
        return attemptsLeft !== null && attemptsLeft > 0
          ? `+${displayPoints} points! ${attemptsLeft} attempts left`
          : `+${displayPoints} points! no more attempts left`
      }
      return 'try again 4 points'
    }

    return (
      <SharePrompt
        title="⌨️ typing complete!"
        score={`${wpm} WPM`}
        scoreLabel={getScoreLabel()}
        shareText={`typed ${wpm} WPM like a true savant ⌨️ imcs.world #IMCS`}
        onPlayAgain={handlePlayAgain}
        showPlayAgain={!maxReached || attemptsLeft === null || attemptsLeft > 0}
      />
    )
  }

  return (
    <TypingTest
      onSuccess={handleSuccess}
      attemptsInfo={attemptsLeft !== null ? `${attemptsLeft}/${MAX_ATTEMPTS} attempts left` : undefined}
    />
  )
}
