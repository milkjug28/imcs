'use client'

import { useState, useEffect, useRef } from 'react'
import { calculateWPM, getTypingSuccessMessage, getTypingFailMessage } from '@/lib/utils'

type TypingTestProps = {
  onSuccess: () => void
}

const TARGET_TEXT = "i wish i was autistic...in like a super hacker programmer type of way…seeing lines of code like a rainman of the matrix. like an imaginary magic crypto savant"
const TARGET_WPM = 30

export default function TypingTest({ onSuccess }: TypingTestProps) {
  const [userInput, setUserInput] = useState('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [wpm, setWpm] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [message, setMessage] = useState('type da text below 2 proov urself!')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (!startTime || userInput.length === 0) return

    // Calculate WPM in real-time
    const timeElapsed = (Date.now() - startTime) / 1000 // seconds
    const currentWpm = calculateWPM(userInput.length, timeElapsed)
    setWpm(currentWpm)

    // Check if complete
    if (userInput.length >= TARGET_TEXT.length) {
      setIsComplete(true)

      if (currentWpm >= TARGET_WPM) {
        // Success!
        setMessage(`${getTypingSuccessMessage()} (${currentWpm} WPM)`)

        // Record success
        recordAttempt(true, currentWpm)

        // Call success callback after delay
        setTimeout(() => {
          onSuccess()
        }, 2000)
      } else {
        // Failed - too slow
        setMessage(`${getTypingFailMessage()} u only got ${currentWpm} WPM, need ${TARGET_WPM}+`)
        recordAttempt(false, currentWpm)
      }
    }
  }, [userInput, startTime])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value

    // Start timer on first keystroke
    if (!startTime && newValue.length === 1) {
      setStartTime(Date.now())
    }

    // Don't allow input beyond target length
    if (newValue.length <= TARGET_TEXT.length) {
      setUserInput(newValue)
    }
  }

  const handleReset = () => {
    setUserInput('')
    setStartTime(null)
    setWpm(0)
    setIsComplete(false)
    setMessage('type da text below 2 proov urself!')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const recordAttempt = async (success: boolean, wpmScore: number) => {
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json')
      const { ip } = await ipResponse.json()

      await fetch('/api/access/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip,
          success,
          score: wpmScore
        })
      })
    } catch (e) {
      console.error('Failed to record typing attempt:', e)
    }
  }

  // Render each character with color coding
  const renderTargetText = () => {
    return TARGET_TEXT.split('').map((char, index) => {
      let color = '#666' // Not yet typed

      if (index < userInput.length) {
        if (userInput[index] === char) {
          color = '#00ff00' // Correct
        } else {
          color = '#ff0000' // Incorrect
        }
      }

      return (
        <span key={index} style={{ color }}>
          {char}
        </span>
      )
    })
  }

  return (
    <div className="typing-test-container">
      {/* Matrix rain background effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #000 0%, #001a00 100%)',
        zIndex: -1
      }} />

      {/* Title */}
      <div style={{
        fontSize: '36px',
        color: '#00ff00',
        textShadow: '2px 2px 0 #000',
        marginBottom: '20px',
        textAlign: 'center',
        fontFamily: 'monospace'
      }}>
        HACKER TEST ACTIVATED
      </div>

      {/* Message */}
      <div style={{
        fontSize: '24px',
        color: '#fff',
        textShadow: '2px 2px 0 #000',
        marginBottom: '30px',
        textAlign: 'center',
        minHeight: '60px'
      }}>
        {message}
      </div>

      {/* WPM Counter */}
      <div style={{
        fontSize: '48px',
        color: wpm >= TARGET_WPM ? '#00ff00' : '#ffff00',
        textShadow: '3px 3px 0 #000',
        marginBottom: '20px',
        textAlign: 'center',
        fontWeight: 'bold',
        animation: wpm >= TARGET_WPM ? 'pulse 0.5s ease-in-out' : 'none'
      }}>
        {wpm} WPM
      </div>

      {/* Target text */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.8)',
        border: '3px solid #00ff00',
        padding: '20px',
        marginBottom: '20px',
        fontSize: '24px',
        fontFamily: 'monospace',
        lineHeight: '1.6',
        maxWidth: '800px',
        color: '#666'
      }}>
        {renderTargetText()}
      </div>

      {/* Input area */}
      <textarea
        ref={inputRef}
        value={userInput}
        onChange={handleInputChange}
        disabled={isComplete}
        placeholder="start typing here..."
        style={{
          width: '100%',
          maxWidth: '800px',
          height: '150px',
          fontFamily: 'monospace',
          fontSize: '24px',
          padding: '15px',
          background: 'rgba(0, 0, 0, 0.9)',
          color: '#00ff00',
          border: '3px solid #00ff00',
          resize: 'none',
          outline: 'none',
          caretColor: '#00ff00'
        }}
      />

      {/* Reset button */}
      {isComplete && (
        <button
          onClick={handleReset}
          style={{
            fontFamily: 'Comic Neue, cursive',
            fontSize: '24px',
            padding: '12px 30px',
            background: '#ffff00',
            border: '3px solid #000',
            cursor: 'pointer',
            boxShadow: '3px 3px 0 #000',
            marginTop: '20px'
          }}
        >
          try agen
        </button>
      )}
    </div>
  )
}
