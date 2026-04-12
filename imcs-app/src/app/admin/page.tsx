'use client'

import { useState, useEffect } from 'react'

type Submission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
  created_at: string
  referrer_code?: string
}

type WhitelistEntry = {
  wallet_address: string
  status: 'approved' | 'pending' | 'rejected'
  method?: string
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [stats, setStats] = useState({ total: 0, whitelisted: 0, pending: 0 })
  const [syncData, setSyncData] = useState('')
  const [syncResult, setSyncResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'submissions' | 'whitelist' | 'sync'>('submissions')

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        setIsAuthenticated(true)
        loadData()
      } else {
        alert('wrong password dummie')
      }
    } catch (error) {
      alert('login failed')
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Get submissions
      const subsRes = await fetch('/api/leaderboard/submissions?limit=1000&include=info')
      const subsData = await subsRes.json()
      setSubmissions(subsData)

      // Calculate stats
      const whitelistedCount = subsData.filter((s: any) => s.whitelist_status === 'approved').length
      setStats({
        total: subsData.length,
        whitelisted: whitelistedCount,
        pending: subsData.length - whitelistedCount
      })
    } catch (error) {
      console.error('Failed to load data:', error)
    }
    setLoading(false)
  }

  const handleSync = async () => {
    if (!syncData.trim()) {
      alert('paste your google sheets data first!')
      return
    }

    setLoading(true)
    setSyncResult(null)

    try {
      const jsonData = JSON.parse(syncData)

      const response = await fetch('/api/admin/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: jsonData
        })
      })

      const result = await response.json()
      setSyncResult(result)

      if (result.success) {
        alert(`Sync complete! Added ${result.report.added}, skipped ${result.report.skipped}`)
        loadData() // Reload data
      }
    } catch (error: any) {
      setSyncResult({ error: error.message })
      alert('Sync failed: ' + error.message)
    }
    setLoading(false)
  }

  const runWhitelistUpdate = async () => {
    if (!confirm('Run auto-whitelist update? This will whitelist users with score >= 3.')) return

    setLoading(true)
    try {
      // This would need a new API endpoint that calls the Supabase function
      alert('Auto-whitelist function needs API endpoint - add this next!')
    } catch (error) {
      alert('Failed to run whitelist update')
    }
    setLoading(false)
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #87CEEB 0%, #98D8E8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
          border: '5px solid #000',
          padding: '40px',
          boxShadow: '10px 10px 0 #000',
          transform: 'rotate(-1deg)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h1 style={{
            fontSize: '36px',
            color: '#fff',
            textShadow: '3px 3px 0 #000',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            admin login
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="enter password..."
            style={{
              width: '100%',
              padding: '12px',
              fontFamily: 'Comic Neue, cursive',
              fontSize: '18px',
              border: '3px solid #000',
              marginBottom: '20px'
            }}
          />
          <button
            onClick={handleLogin}
            style={{
              width: '100%',
              fontFamily: 'Comic Neue, cursive',
              fontSize: '24px',
              padding: '12px',
              background: '#00ff00',
              border: '3px solid #000',
              cursor: 'pointer',
              boxShadow: '3px 3px 0 #000'
            }}
          >
            login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #87CEEB 0%, #98D8E8 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '48px',
          color: '#fff',
          textShadow: '3px 3px 0 #000',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          IMCS Admin Dashboard
        </h1>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{
            background: '#fff',
            border: '4px solid #000',
            padding: '20px',
            boxShadow: '5px 5px 0 #000',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ff00ff' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '18px' }}>Total Submissions</div>
          </div>
          <div style={{
            background: '#fff',
            border: '4px solid #000',
            padding: '20px',
            boxShadow: '5px 5px 0 #000',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#00ff00' }}>
              {stats.whitelisted}
            </div>
            <div style={{ fontSize: '18px' }}>Whitelisted</div>
          </div>
          <div style={{
            background: '#fff',
            border: '4px solid #000',
            padding: '20px',
            boxShadow: '5px 5px 0 #000',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ffd700' }}>
              {stats.pending}
            </div>
            <div style={{ fontSize: '18px' }}>Pending</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px'
        }}>
          {['submissions', 'sync'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: '20px',
                padding: '10px 20px',
                background: activeTab === tab ? '#ff6b9d' : '#ffff00',
                border: '3px solid #000',
                cursor: 'pointer',
                boxShadow: '3px 3px 0 #000',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: '20px',
              padding: '10px 20px',
              background: '#00bfff',
              border: '3px solid #000',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '3px 3px 0 #000',
              marginLeft: 'auto'
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Submissions Tab */}
        {activeTab === 'submissions' && (
          <div style={{
            background: '#fff',
            border: '5px solid #000',
            padding: '20px',
            boxShadow: '10px 10px 0 #000',
            overflowX: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ fontSize: '28px' }}>All Submissions</h2>
              <button
                onClick={runWhitelistUpdate}
                style={{
                  fontFamily: 'Comic Neue, cursive',
                  fontSize: '18px',
                  padding: '8px 16px',
                  background: '#00ff00',
                  border: '3px solid #000',
                  cursor: 'pointer',
                  boxShadow: '3px 3px 0 #000'
                }}
              >
                Run Auto-Whitelist
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ padding: '10px', border: '2px solid #000', textAlign: 'left' }}>Wallet</th>
                  <th style={{ padding: '10px', border: '2px solid #000', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '10px', border: '2px solid #000', textAlign: 'left' }}>Info</th>
                  <th style={{ padding: '10px', border: '2px solid #000', textAlign: 'center' }}>Score</th>
                  <th style={{ padding: '10px', border: '2px solid #000', textAlign: 'center' }}>WL Status</th>
                  <th style={{ padding: '10px', border: '2px solid #000', textAlign: 'left' }}>Referral Code</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td style={{ padding: '10px', border: '1px solid #ccc', fontSize: '12px', fontFamily: 'monospace' }}>
                      {sub.wallet_address.slice(0, 6)}...{sub.wallet_address.slice(-4)}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ccc' }}>{sub.name}</td>
                    <td style={{ padding: '10px', border: '1px solid #ccc', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub.info}
                    </td>
                    <td style={{
                      padding: '10px',
                      border: '1px solid #ccc',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: sub.score >= 3 ? '#00ff00' : sub.score >= 0 ? '#000' : '#ff0000'
                    }}>
                      {sub.score}
                    </td>
                    <td style={{
                      padding: '10px',
                      border: '1px solid #ccc',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: (sub as any).whitelist_status === 'approved' ? '#00ff00' : '#999'
                    }}>
                      {(sub as any).whitelist_status || 'pending'}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ccc', fontSize: '12px', fontFamily: 'monospace' }}>
                      {sub.referrer_code || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sync Tab */}
        {activeTab === 'sync' && (
          <div style={{
            background: '#fff',
            border: '5px solid #000',
            padding: '30px',
            boxShadow: '10px 10px 0 #000'
          }}>
            <h2 style={{ fontSize: '28px', marginBottom: '20px' }}>Sync Google Sheets to Supabase</h2>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>Instructions:</h3>
              <ol style={{ fontSize: '16px', lineHeight: '1.6' }}>
                <li>Export your Google Sheet as CSV</li>
                <li>Convert to JSON at: <a href="https://csvjson.com/csv2json" target="_blank" style={{ color: '#0066cc' }}>csvjson.com/csv2json</a></li>
                <li>Paste the JSON data below</li>
                <li>Click &quot;Sync to Supabase&quot;</li>
              </ol>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '18px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
                JSON Data:
              </label>
              <textarea
                value={syncData}
                onChange={(e) => setSyncData(e.target.value)}
                placeholder='[{"name":"Alice","info":"my submission","wallet_address":"0x...","timestamp":"2026-01-01"}]'
                style={{
                  width: '100%',
                  height: '300px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  padding: '10px',
                  border: '3px solid #000',
                  resize: 'vertical'
                }}
              />
            </div>

            <button
              onClick={handleSync}
              disabled={loading}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: '24px',
                padding: '15px 30px',
                background: '#00ff00',
                border: '4px solid #000',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '5px 5px 0 #000',
                marginBottom: '20px'
              }}
            >
              {loading ? 'Syncing...' : 'Sync to Supabase'}
            </button>

            {syncResult && (
              <div style={{
                background: syncResult.success ? '#d4edda' : '#f8d7da',
                border: '3px solid #000',
                padding: '20px',
                marginTop: '20px'
              }}>
                <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>
                  {syncResult.success ? '✅ Sync Result' : '❌ Error'}
                </h3>
                <pre style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}>
                  {JSON.stringify(syncResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
