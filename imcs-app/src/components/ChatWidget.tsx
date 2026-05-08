'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount } from 'wagmi'

type ChatMessage = {
  id: string
  wallet_address: string
  username: string
  message: string
  is_bot: boolean
  created_at: string
}

const BOT_WALLETS = new Set([
  '0xB07000000000000000000000000000000000000001',
  '0xB07000000000000000000000000000000000000002',
  '0xB07000000000000000000000000000000000000003',
  '0xB07000000000000000000000000000000000000004',
])

const STYLE_COLORS: Record<string, string> = {
  CryptoGoblin: '#00ff88',
  sAvAnTqUeEn: '#ff69b4',
  wagmi_wizard: '#9b59b6',
  ape_brain_420: '#ff6600',
}

export default function ChatWidget() {
  const { address, isConnected } = useAccount()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [username, setUsername] = useState<string | null>(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [settingUsername, setSettingUsername] = useState(false)
  const [showUsernameForm, setShowUsernameForm] = useState(false)
  const [sending, setSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastMessageTime = useRef<string | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (lastMessageTime.current) {
        params.set('since', lastMessageTime.current)
      } else {
        params.set('limit', '50')
      }
      const res = await fetch(`/api/chat/messages?${params}`)
      const data = await res.json()
      if (data.messages?.length) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const newMsgs = data.messages.filter((m: ChatMessage) => !existingIds.has(m.id))
          if (newMsgs.length === 0) return prev
          const merged = [...prev, ...newMsgs].slice(-200)
          lastMessageTime.current = merged[merged.length - 1].created_at
          if (!isOpen) {
            setUnreadCount(c => c + newMsgs.length)
          }
          return merged
        })
      }
    } catch {}
  }, [isOpen])

  const fetchUsername = useCallback(async () => {
    if (!address) return
    try {
      const res = await fetch(`/api/chat/username?wallet=${address}`)
      const data = await res.json()
      setUsername(data.username || null)
    } catch {}
  }, [address])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (isOpen) {
      pollRef.current = setInterval(fetchMessages, 3000)
      setUnreadCount(0)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isOpen, fetchMessages])

  useEffect(() => {
    if (isConnected && address) fetchUsername()
  }, [isConnected, address, fetchUsername])

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [messages, isOpen])

  const sendMessage = async () => {
    if (!input.trim() || !address || sending) return
    setSending(true)
    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          message: input.trim(),
          username,
        }),
      })
      setInput('')
      await fetchMessages()
    } catch {}
    setSending(false)
  }

  const saveUsername = async () => {
    if (!usernameInput.trim() || !address) return
    setSettingUsername(true)
    try {
      const res = await fetch('/api/chat/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, username: usernameInput.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setUsername(data.username)
        setShowUsernameForm(false)
        setUsernameInput('')
      } else {
        alert(data.error || 'failed 2 set name')
      }
    } catch {}
    setSettingUsername(false)
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isOwnMessage = (msg: ChatMessage) =>
    address && msg.wallet_address.toLowerCase() === address.toLowerCase()

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff69b4, #ff6600)',
          border: '3px solid #000',
          boxShadow: '4px 4px 0px #000',
          cursor: 'pointer',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {isOpen ? '✕' : '💬'}
        {!isOpen && unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ff0000',
            color: '#fff',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #000',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '86px',
          right: '20px',
          width: '360px',
          maxWidth: 'calc(100vw - 40px)',
          height: '480px',
          maxHeight: 'calc(100vh - 120px)',
          background: '#1a1a2e',
          border: '3px solid #ff69b4',
          borderRadius: '12px',
          boxShadow: '6px 6px 0px #000',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          fontFamily: "'Comic Neue', cursive",
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            background: 'linear-gradient(90deg, #ff69b4, #ff6600, #ff69b4)',
            borderBottom: '2px solid #000',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 'bold', color: '#000', fontSize: '14px' }}>
              savant chat 💀
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isConnected && (
                <button
                  onClick={() => setShowUsernameForm(!showUsernameForm)}
                  style={{
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {username || 'set name'}
                </button>
              )}
            </div>
          </div>

          {/* Username form */}
          {showUsernameForm && isConnected && (
            <div style={{
              padding: '8px 14px',
              background: '#16213e',
              borderBottom: '1px solid #333',
              display: 'flex',
              gap: '6px',
            }}>
              <input
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                placeholder="enter username..."
                maxLength={20}
                style={{
                  flex: 1,
                  background: '#0f0f23',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  color: '#fff',
                  fontSize: '12px',
                  fontFamily: "'Comic Neue', cursive",
                }}
              />
              <button
                onClick={saveUsername}
                disabled={settingUsername}
                style={{
                  background: '#ff69b4',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {settingUsername ? '...' : 'save'}
              </button>
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            {messages.length === 0 && (
              <div style={{ color: '#666', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>
                no messages yet... be first savant 2 speek
              </div>
            )}
            {messages.map(msg => {
              const own = isOwnMessage(msg)
              const isBot = BOT_WALLETS.has(msg.wallet_address)
              const nameColor = isBot
                ? (STYLE_COLORS[msg.username] || '#ff69b4')
                : own ? '#ffff00' : '#88ccff'

              return (
                <div key={msg.id} style={{
                  maxWidth: '85%',
                  alignSelf: own ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    fontSize: '10px',
                    color: nameColor,
                    marginBottom: '2px',
                    fontWeight: 'bold',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}>
                    <span>{msg.username}</span>
                    <span style={{ color: '#555', fontWeight: 'normal' }}>{formatTime(msg.created_at)}</span>
                  </div>
                  <div style={{
                    background: own ? '#2a1a4e' : isBot ? '#1e2a1e' : '#16213e',
                    border: `1px solid ${own ? '#9b59b6' : isBot ? '#2ecc71' : '#333'}`,
                    borderRadius: '8px',
                    padding: '6px 10px',
                    color: '#e0e0e0',
                    fontSize: '13px',
                    wordBreak: 'break-word',
                    lineHeight: '1.4',
                  }}>
                    {msg.message}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '10px',
            borderTop: '2px solid #333',
            background: '#0f0f23',
          }}>
            {!isConnected ? (
              <div style={{
                color: '#ff69b4',
                textAlign: 'center',
                fontSize: '13px',
                padding: '8px',
              }}>
                connect wallet 2 chat, nerd
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="say sumthin..."
                  maxLength={500}
                  style={{
                    flex: 1,
                    background: '#1a1a2e',
                    border: '2px solid #333',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '13px',
                    fontFamily: "'Comic Neue', cursive",
                    outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#ff69b4')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#333')}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  style={{
                    background: sending ? '#555' : 'linear-gradient(135deg, #ff69b4, #ff6600)',
                    border: '2px solid #000',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    color: '#000',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    fontFamily: "'Comic Neue', cursive",
                  }}
                >
                  {sending ? '...' : 'send'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
