'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/hooks/useWallet'
import ConnectWallet from '@/components/ConnectWallet'

type ProfileData = {
  wallet_address: string
  name: string
  info: string
  submission_score: number
  submitted_at: string
  referrer_code?: string
  voting_karma: number
  whitelist_status: string
  whitelist_method?: string
  referrals_made: number
  rank?: number
  task_points?: number
  total_points?: number
}

type TaskCompletion = {
  task_type: string
  score: number
  completion_count?: number
  completed_at: string
}

export default function ProfilePage() {
  const { address, isConnected, truncatedAddress } = useWallet()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [completedTasks, setCompletedTasks] = useState<TaskCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rank, setRank] = useState<number | null>(null)

  const fetchAllData = useCallback(async () => {
    if (!address) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Fetch profile and tasks in parallel
      const [profileRes, tasksRes] = await Promise.all([
        fetch(`/api/profile/${address}`, { cache: 'no-store' }),
        fetch(`/api/tasks/${address}`, { cache: 'no-store' })
      ])

      // Process profile - this now includes correct total_points from API
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setProfile(profileData)
        setRank(profileData.rank || null)
        setError(null)
      } else {
        setError('ur wallet not savant yet. submit form first, nerd')
        setProfile(null)
      }

      // Process tasks
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setCompletedTasks(tasksData.tasks || [])
      }
    } catch (e) {
      console.error('Failed to fetch profile data:', e)
      setError('error loading profile')
    }

    setLoading(false)
  }, [address])

  // Fetch on mount and when address changes
  useEffect(() => {
    if (isConnected && address) {
      fetchAllData()
    } else {
      setLoading(false)
    }
  }, [isConnected, address, fetchAllData])


  // Total points comes directly from the API - it calculates correctly
  const totalPoints = profile?.total_points || 0

  const referralCode = address ? address.slice(2, 10).toUpperCase() : ''

  const handleShare = () => {
    const shareText = `im a savant with ${totalPoints} points! can u beat me? 🧙‍♂️✨ imcs.world #IMCS`
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    window.open(shareUrl, '_blank')
  }

  const copyReferralCode = () => {
    // Link to homepage with ref param - it will be stored and used on submit
    navigator.clipboard.writeText(`https://imcs.world?ref=${referralCode}`)
    alert('copied 2 clipboard!')
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 className="form-title">my savant profil</h2>
          <p style={{ fontSize: '24px', marginBottom: '30px' }}>
            connect ur wallut 2 c ur stats
          </p>
          <ConnectWallet label="connect wallut" />
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="loading-spinner" style={{ marginBottom: '20px' }} />
          <h2 className="form-title">loading...</h2>
        </div>
      </div>
    )
  }

  // Error state - not on list
  if (error || !profile) {
    return (
      <div className="page active">
        <div className="form-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 className="form-title">u dont exist yet</h2>
          <p style={{ fontSize: '20px', marginBottom: '20px' }}>
            {truncatedAddress}
          </p>
          <p style={{ fontSize: '24px', marginBottom: '30px' }}>
            ur wallet not savant yet, dummie
          </p>
          <button
            onClick={() => window.location.href = '/site/tasks'}
            className="submit-btn"
          >
            proove im savant
          </button>
        </div>
      </div>
    )
  }

  const isWhitelisted = profile.whitelist_status === 'approved'

  return (
    <div className="page active">
      {/* Profile card */}
      <div
        className={`profile-card ${isWhitelisted ? 'whitelisted' : ''}`}
        style={{
          maxWidth: '700px',
          margin: '30px auto',
          padding: '30px',
        }}
      >
        <h2 className="form-title" style={{ marginBottom: '10px' }}>
          {profile.name}
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#000',
          marginBottom: '20px',
          fontFamily: 'monospace',
        }}>
          {truncatedAddress}
        </p>

        {/* Total points */}
        <div className="profile-score">
          {totalPoints}
        </div>
        <p style={{ fontSize: '20px', marginBottom: '20px' }}>
          total points
        </p>

        {/* Rank */}
        {rank && (
          <p style={{
            fontSize: '24px',
            color: '#fff',
            textShadow: '2px 2px 0 #000',
            marginBottom: '20px',
          }}>
            rank #{rank}
          </p>
        )}

        {/* Stats grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '15px',
          marginBottom: '25px',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.3)',
            padding: '15px',
            border: '3px solid #000',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {profile.submission_score || 0}
            </div>
            <div style={{ fontSize: '14px' }}>vote score</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.3)',
            padding: '15px',
            border: '3px solid #000',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {profile.voting_karma || 0}
            </div>
            <div style={{ fontSize: '14px' }}>voting karma</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.3)',
            padding: '15px',
            border: '3px solid #000',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {completedTasks.reduce((sum, t) => sum + (t.score || 0), 0)}
            </div>
            <div style={{ fontSize: '14px' }}>task points</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.3)',
            padding: '15px',
            border: '3px solid #000',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {profile.referrals_made || 0}
            </div>
            <div style={{ fontSize: '14px' }}>referrals</div>
          </div>
        </div>

        {/* Whitelist status */}
        <div className="profile-status" style={{ marginBottom: '20px' }}>
          {isWhitelisted ? (
            <span style={{ color: '#fff' }}>CONGRAAAATS U AR SAVANT! ✅🎉</span>
          ) : (
            <>
              <span style={{ color: '#ffff00' }}>not savant yet... keep grinding!</span>
              <div style={{
                fontSize: '14px',
                color: '#fff',
                marginTop: '8px',
                textShadow: '1px 1px 0 #000',
              }}>
                {totalPoints} / 1017 pts needed 4 whitelist
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '10px',
                  height: '16px',
                  marginTop: '6px',
                  border: '2px solid #000',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    background: 'linear-gradient(90deg, #ff00ff, #00ff00)',
                    height: '100%',
                    width: `${Math.min(100, (totalPoints / 1017) * 100)}%`,
                    borderRadius: '8px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Referral code */}
        <div style={{
          background: '#fff',
          padding: '15px',
          border: '3px solid #000',
          marginBottom: '20px',
        }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>ur referral code:</p>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '24px',
            fontWeight: 'bold',
            letterSpacing: '2px',
          }}>
            {referralCode}
          </div>
          <button
            onClick={copyReferralCode}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '14px',
              padding: '8px 16px',
              background: '#ffff00',
              border: '2px solid #000',
              cursor: 'pointer',
              marginTop: '10px',
            }}
          >
            copy link
          </button>
        </div>

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '15px',
            border: '3px solid #000',
            marginBottom: '20px',
          }}>
            <p style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold' }}>
              completed tasks:
            </p>
            {completedTasks.map((task, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < completedTasks.length - 1 ? '1px solid rgba(0,0,0,0.2)' : 'none',
              }}>
                <span>
                  ✅ {task.task_type}
                  {task.completion_count && task.completion_count > 1 && (
                    <span style={{ fontSize: '12px', color: '#666' }}> (x{task.completion_count})</span>
                  )}
                </span>
                <span>+{task.score} pts</span>
              </div>
            ))}
          </div>
        )}

        {/* Share button */}
        <button
          onClick={handleShare}
          className="submit-btn"
          style={{ background: '#1DA1F2', color: '#fff' }}
        >
          share on X 🐦
        </button>
      </div>
    </div>
  )
}
