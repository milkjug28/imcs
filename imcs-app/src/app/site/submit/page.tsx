'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { submitForm } from '@/lib/api-client'
import { isValidAddress } from '@/lib/utils'
import ConnectWallet from '@/components/ConnectWallet'

function SubmitPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { address, isConnected, truncatedAddress } = useWallet()

  const [formData, setFormData] = useState({ name: '', info: '' })
  const [referralCode, setReferralCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [submittedCode, setSubmittedCode] = useState<string | null>(null)
  const [justSubmitted, setJustSubmitted] = useState(false)

  // Check for referral code in URL params or localStorage
  useEffect(() => {
    // First check URL params
    const refCode = searchParams.get('ref')
    if (refCode) {
      setReferralCode(refCode.toUpperCase())
      // Also store in localStorage for persistence
      localStorage.setItem('referralCode', refCode.toUpperCase())
    } else {
      // Check localStorage (may have been set on landing page)
      const storedRef = localStorage.getItem('referralCode')
      if (storedRef) {
        setReferralCode(storedRef)
      }
    }
  }, [searchParams])

  const checkExistingProfile = useCallback(async () => {
    if (!address || justSubmitted || submittedCode) return
    setCheckingProfile(true)

    try {
      const response = await fetch(`/api/profile/${address}`)
      if (response.ok) {
        const data = await response.json()
        // Check if user actually has a submission (not just a base profile)
        if (data.has_submission) {
          setHasProfile(true)
          // User already registered - redirect to tasks
          router.push('/site/tasks')
        } else {
          setHasProfile(false)
        }
      } else {
        setHasProfile(false)
      }
    } catch (e) {
      setHasProfile(false)
    }

    setCheckingProfile(false)
  }, [address, justSubmitted, submittedCode, router])

  // Check if user already has a profile when wallet connects
  // BUT don't check if we just submitted (let success screen show)
  useEffect(() => {
    if (isConnected && address && !justSubmitted) {
      checkExistingProfile()
    } else {
      setCheckingProfile(false)
    }
  }, [isConnected, address, justSubmitted, checkExistingProfile])

  const handleSubmit = async () => {
    if (!address) {
      setMessage('connect ur wallut first dummie')
      return
    }

    if (!formData.name || !formData.info) {
      setMessage('fill out all fields dummie')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const result = await submitForm({
        wallet_address: address,
        name: formData.name,
        info: formData.info,
        referrer_code: referralCode || undefined,
      })

      if (result.success) {
        // Clear the referral code from localStorage (it's been used)
        localStorage.removeItem('referralCode')

        // Generate referral code from wallet
        const newCode = address.slice(2, 10).toUpperCase()
        
        // Set flag to prevent profile check from redirecting
        setJustSubmitted(true)
        
        // Show success screen
        setSubmittedCode(newCode)
        
        // Clear loading state
        setLoading(false)

        // Mark submit task as complete (fire and forget)
        fetch('/api/tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: address,
            task_type: 'submit',
            score: 150,
          }),
        }).catch(e => {
          console.error('Failed to record task completion:', e)
        })
      } else {
        setLoading(false)
      }
    } catch (error: any) {
      setMessage(error.message || 'submission failed')
      setLoading(false)
    }
  }

  const copyReferralLink = () => {
    if (submittedCode) {
      navigator.clipboard.writeText(`https://imcs.world?ref=${submittedCode}`)
      alert('copied 2 clipboard!')
    }
  }

  // Loading state while checking profile
  if (checkingProfile) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 className="form-title">checking...</h2>
          <div style={{ fontSize: '48px' }}>⏳</div>
        </div>
      </div>
    )
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h2 className="form-title">becum savant</h2>
          <p style={{ fontSize: '20px', marginBottom: '30px' }}>
            connect ur wallut 2 register
          </p>
          <ConnectWallet label="connect wallut" />

          {/* Show referral code if present */}
          {referralCode && (
            <p style={{
              marginTop: '20px',
              fontSize: '16px',
              color: '#00ff00',
            }}>
              ✨ using referral code: {referralCode}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Success state
  if (submittedCode) {
    return (
      <div className="page active">
        <div className="success-message">
          <h2>🎉 CONGRAAAATS! 🎉</h2>
          <p>ur now on da savant lissst!</p>
          <p style={{ marginTop: '15px' }}>+150 points earned!</p>

          <p style={{ marginTop: '20px' }}>share ur referral code 2 get bonus points:</p>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '28px',
            background: '#fff',
            padding: '15px',
            border: '3px solid #000',
            margin: '15px 0',
            letterSpacing: '2px'
          }}>
            {submittedCode}
          </div>

          <button
            onClick={copyReferralLink}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '16px',
              padding: '10px 20px',
              background: '#ffff00',
              border: '3px solid #000',
              cursor: 'pointer',
              marginBottom: '20px',
            }}
          >
            copy referral link
          </button>

          <button
            className="submit-btn"
            onClick={() => router.push('/site/tasks')}
          >
            do more tasks 4 points
          </button>
        </div>
      </div>
    )
  }

  // Registration form
  return (
    <div className="page active">
      <div className="form-container">
        <h2 className="form-title">becum savant</h2>

        <p style={{
          fontSize: '16px',
          textAlign: 'center',
          marginBottom: '20px',
          background: '#fff',
          padding: '10px',
          border: '2px solid #000',
        }}>
          connected: {truncatedAddress}
        </p>

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

        <div className="form-group">
          <label>referral code (optional):</label>
          <input
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="got a code from a frend?"
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'submitting...' : 'submit (+150 pts)'}
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
}

// Wrap in Suspense for useSearchParams
export default function SubmitPage() {
  return (
    <Suspense fallback={
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 className="form-title">loading...</h2>
          <div style={{ fontSize: '48px' }}>⏳</div>
        </div>
      </div>
    }>
      <SubmitPageContent />
    </Suspense>
  )
}
