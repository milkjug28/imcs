'use client'

import { useState } from 'react'
import CircleDrawing from '@/components/gates/CircleDrawing'
import TypingTest from '@/components/gates/TypingTest'
import { submitForm } from '@/lib/api-client'
import { isValidAddress } from '@/lib/utils'

type Stage = 'initial' | 'wallet-check' | 'circle-test' | 'typing-test' | 'add-to-wallet' | 'form' | 'success'

export default function SubmitPage() {
  const [stage, setStage] = useState<Stage>('initial')
  const [walletInput, setWalletInput] = useState('')
  const [walletInfo, setWalletInfo] = useState<any>(null)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [earnedAccuracy, setEarnedAccuracy] = useState(0)
  const [formData, setFormData] = useState({ name: '', wallet: '', info: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Initial screen: 2 options
  const renderInitial = () => (
    <div className="page active">
      <div className="form-container" style={{ maxWidth: '600px', margin: '50px auto' }}>
        <h2 className="form-title">savaant lissst</h2>
        <p style={{ fontSize: '20px', textAlign: 'center', marginBottom: '30px' }}>
          wut u wanna do?
        </p>

        <button
          className="submit-btn"
          onClick={() => setStage('wallet-check')}
          style={{ marginBottom: '20px' }}
        >
          check wallet
        </button>

        <button
          className="submit-btn"
          onClick={() => setStage('circle-test')}
        >
          proov i em savaant
        </button>
      </div>
    </div>
  )

  // Wallet check
  const renderWalletCheck = () => (
    <div className="page active">
      <div className="form-container">
        <h2 className="form-title">check wallet</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', textAlign: 'center' }}>
          paste ur wallut adress 2 c if ur on da lissst
        </p>

        <div className="form-group">
          <input
            type="text"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            placeholder="0x..."
            style={{ marginBottom: '20px' }}
          />
        </div>

        <button
          className="submit-btn"
          onClick={handleWalletCheck}
          disabled={loading}
          style={{ marginBottom: '15px' }}
        >
          {loading ? 'checking...' : 'check'}
        </button>

        <button
          onClick={() => setStage('initial')}
          style={{
            width: '100%',
            fontFamily: 'Comic Neue, cursive',
            fontSize: '18px',
            padding: '10px',
            background: '#ccc',
            border: '3px solid #000',
            cursor: 'pointer'
          }}
        >
          bak
        </button>

        {message && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            background: walletInfo ? '#d4edda' : '#f8d7da',
            border: '3px solid #000',
            fontSize: '18px'
          }}>
            {message}
          </div>
        )}

        {walletInfo && (
          <div style={{ marginTop: '20px' }}>
            <button
              className="submit-btn"
              onClick={() => setStage('circle-test')}
            >
              proov i em savaant 4 bonus points
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // Circle test
  const renderCircleTest = () => (
    <CircleDrawing
      onSubmit={handleCircleSubmit}
      onGiveUp={handleCircleGiveUp}
    />
  )

  // Typing test (fallback when user gives up on circle)
  const renderTypingTest = () => (
    <TypingTest onSuccess={handleTypingSuccess} />
  )

  // Add points to existing wallet
  const renderAddToWallet = () => (
    <div className="page active">
      <div className="form-container">
        <h2 className="form-title">add {earnedPoints} points</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', textAlign: 'center' }}>
          paste ur wallut adress 2 add {earnedPoints} points
        </p>

        <div className="form-group">
          <input
            type="text"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            placeholder="0x..."
          />
        </div>

        <button
          className="submit-btn"
          onClick={handleAddPoints}
          disabled={loading}
          style={{ marginBottom: '15px' }}
        >
          {loading ? 'adding...' : 'add points'}
        </button>

        <button
          onClick={() => setStage('choose-action')}
          style={{
            width: '100%',
            fontFamily: 'Comic Neue, cursive',
            fontSize: '18px',
            padding: '10px',
            background: '#ccc',
            border: '3px solid #000',
            cursor: 'pointer'
          }}
        >
          bak
        </button>

        {message && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            background: '#f8d7da',
            border: '3px solid #000',
            fontSize: '18px'
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )

  // Full submission form
  const renderForm = () => (
    <div className="page active">
      <div className="form-container">
        <h2 className="form-title">becum savant</h2>
        {earnedPoints > 0 && (
          <p style={{ fontSize: '18px', textAlign: 'center', marginBottom: '20px', color: '#00ff00' }}>
            starting with {earnedPoints} points from circle test! ✨
          </p>
        )}

        <div className="form-group">
          <label>ur naem:</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="wat do we cal u?"
          />
        </div>

        <div className="form-group">
          <label>ur wallut adress:</label>
          <input
            type="text"
            value={formData.wallet}
            onChange={(e) => setFormData({ ...formData, wallet: e.target.value })}
            placeholder="0x..."
          />
        </div>

        <div className="form-group">
          <label>sum info bout u:</label>
          <textarea
            value={formData.info}
            onChange={(e) => setFormData({ ...formData, info: e.target.value })}
            placeholder="tel us sumthin interesting..."
            style={{
              width: '100%',
              padding: '12px',
              fontFamily: 'Comic Neue, cursive',
              fontSize: '18px',
              border: '3px solid #000',
              minHeight: '120px',
              resize: 'vertical'
            }}
          />
        </div>

        <button
          className="submit-btn"
          onClick={handleFormSubmit}
          disabled={loading}
        >
          {loading ? 'submitting...' : 'submit'}
        </button>

        {message && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            background: '#f8d7da',
            border: '3px solid #000',
            fontSize: '18px'
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )

  // Success screen
  const renderSuccess = () => (
    <div className="page active">
      <div className="success-message">
        <h2>🎉 CONGRAAAATS! 🎉</h2>
        <p>ur now on da savant lissst!</p>
        <p>share ur referral code 2 get bonus points:</p>
        <div style={{
          fontFamily: 'monospace',
          fontSize: '28px',
          background: '#fff',
          padding: '15px',
          border: '3px solid #000',
          margin: '20px 0',
          letterSpacing: '2px'
        }}>
          {walletInfo?.referrer_code || 'LOADING...'}
        </div>
        <button
          className="submit-btn"
          onClick={() => window.location.href = '/site/vote'}
        >
          vote on other savants
        </button>
      </div>
    </div>
  )

  // Handlers
  const handleWalletCheck = async () => {
    if (!isValidAddress(walletInput)) {
      setMessage('invalid wallet address dummie')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch(`/api/profile/${walletInput}`)

      if (response.ok) {
        const data = await response.json()
        setWalletInfo(data)
        setMessage(`✅ ur on da lissst! rank: ${data.rank || '?'} | score: ${data.submission_score}`)
      } else {
        setWalletInfo(null)
        setMessage('❌ ur wallet not on da lissst yet. proov i em savaant to get on!')
      }
    } catch (error) {
      setMessage('error checking wallet')
    }

    setLoading(false)
  }

  const handleCircleSubmit = (score: number, accuracy: number) => {
    setEarnedPoints(score)
    setEarnedAccuracy(accuracy)
    setStage('add-to-wallet')
  }

  const handleCircleGiveUp = () => {
    // User gave up on circle test, send to typing test
    setStage('typing-test')
  }

  const handleTypingSuccess = () => {
    // Typing test passed - give minimum points (1 point)
    setEarnedPoints(1)
    setEarnedAccuracy(100) // Typing test doesn't have accuracy, but we need a value
    setStage('add-to-wallet')
  }

  const handleAddPoints = async () => {
    if (!isValidAddress(walletInput)) {
      setMessage('invalid wallet address')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // Check if wallet exists
      const checkResponse = await fetch(`/api/profile/${walletInput}`)

      if (checkResponse.ok) {
        // Wallet exists - add points via bonus endpoint
        const bonusResponse = await fetch('/api/bonus/circle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: walletInput,
            bonus_points: earnedPoints,
            accuracy: earnedAccuracy
          })
        })

        const bonusResult = await bonusResponse.json()

        if (bonusResult.success) {
          setWalletInfo({ ...walletInfo, referrer_code: 'EXISTING' })
          setMessage(`✅ ${bonusResult.message}`)
          setTimeout(() => setStage('success'), 1500)
        } else {
          setMessage(`❌ ${bonusResult.error}`)
        }
      } else {
        // Wallet doesn't exist
        setMessage('❌ dat wallut not on lissst. u need 2 fell owt forhm first!')
        setTimeout(() => {
          setFormData({ ...formData, wallet: walletInput })
          setStage('form')
        }, 2000)
      }
    } catch (error) {
      setMessage('error adding points')
    }

    setLoading(false)
  }

  const handleFormSubmit = async () => {
    if (!formData.name || !formData.wallet || !formData.info) {
      setMessage('fill out all fields dummie')
      return
    }

    if (!isValidAddress(formData.wallet)) {
      setMessage('invalid wallet address')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const result = await submitForm({
        wallet_address: formData.wallet,
        name: formData.name,
        info: formData.info
      })

      if (result.success) {
        setWalletInfo(result.submission)

        // If they earned points from circle test, add them
        if (earnedPoints > 0) {
          try {
            const bonusResponse = await fetch('/api/bonus/circle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wallet_address: formData.wallet,
                bonus_points: earnedPoints,
                accuracy: earnedAccuracy
              })
            })

            const bonusResult = await bonusResponse.json()
            if (bonusResult.success) {
              console.log(`Added ${earnedPoints} bonus points from circle test`)
            }
          } catch (error) {
            console.error('Failed to add bonus points:', error)
          }
        }

        setStage('success')
      }
    } catch (error: any) {
      setMessage(error.message || 'submission failed')
    }

    setLoading(false)
  }

  // Render current stage
  switch (stage) {
    case 'initial':
      return renderInitial()
    case 'wallet-check':
      return renderWalletCheck()
    case 'circle-test':
      return renderCircleTest()
    case 'typing-test':
      return renderTypingTest()
    case 'add-to-wallet':
      return renderAddToWallet()
    case 'form':
      return renderForm()
    case 'success':
      return renderSuccess()
    default:
      return renderInitial()
  }
}
