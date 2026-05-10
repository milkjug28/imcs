'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type TranslationMode = 'to_imcs' | 'from_imcs'

const HAND_DRAWN_LEFT = '15px 225px 15px 255px / 225px 15px 225px 15px'
const HAND_DRAWN_RIGHT = '225px 15px 225px 15px / 15px 225px 15px 255px'
const HAND_DRAWN_BUTTON = '50px 15px 70px 15px / 15px 70px 15px 50px'

const decorativeTexts = [
  { text: 'i am an imaginary magic crypto savant', rotate: 2, color: '#000' },
  { text: 'i am an imaginary magic crypto savant', rotate: -5, color: '#2563eb' },
  { text: 'i am an imaginary magic crypto savant', rotate: 1, color: '#000' },
  { text: 'i am an imaginary magic crypto savant', rotate: -2, color: '#ff69b4' },
  { text: 'i am an imaginary magic crypto savant', rotate: 3, color: '#000' },
  { text: 'i am an imaginary magic crypto savant', rotate: -8, color: '#22c55e' },
  { text: 'i am an imaginary magic crypto savant', rotate: 12, color: '#000' },
  { text: 'i am an imaginary magic crypto savant', rotate: -1, color: '#ff6600' },
]

export default function HomePage() {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [mode, setMode] = useState<TranslationMode>('to_imcs')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const translate = async () => {
    if (!inputText.trim()) return
    setIsLoading(true)
    setOutputText('')
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, mode }),
      })
      const data = await res.json()
      if (res.ok) {
        setOutputText(data.translation)
      } else {
        setOutputText(data.error || 'sumthin broked...')
      }
    } catch {
      setOutputText('error: translashun machine broke... sry frens')
    }
    setIsLoading(false)
  }

  const toggleMode = () => {
    setMode(prev => prev === 'to_imcs' ? 'from_imcs' : 'to_imcs')
    setInputText('')
    setOutputText('')
  }

  const copyOutput = () => {
    if (!outputText) return
    navigator.clipboard.writeText(outputText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page active" id="home" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Dot grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0.03,
        backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />

      {/* Background decorative text */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '60px 40px',
        padding: '40px',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.06,
      }}>
        {decorativeTexts.map((item, i) => (
          <span key={i} style={{
            transform: `rotate(${item.rotate}deg)`,
            color: item.color,
            fontSize: 'clamp(14px, 3vw, 24px)',
            fontFamily: "'Comic Neue', cursive",
            fontWeight: 700,
            fontStyle: 'italic',
            whiteSpace: 'nowrap',
          }}>
            {item.text}
          </span>
        ))}
      </div>

      <div style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '740px',
        margin: '0 auto',
        padding: '16px',
      }}>
        {/* Mode Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '14px',
          paddingTop: '0px',
        }}>
          <button
            onClick={() => mode !== 'to_imcs' && toggleMode()}
            style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: 'clamp(14px, 3.5vw, 17px)',
              fontWeight: 'bold',
              padding: '6px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: mode === 'to_imcs' ? '#ff69b4' : '#999',
              textDecoration: mode === 'to_imcs' ? 'underline' : 'none',
              textDecorationColor: '#ff69b4',
              textUnderlineOffset: '8px',
              textDecorationThickness: '4px',
              transition: 'color 0.2s',
            }}
          >
            normie 2 savant
          </button>
          <span style={{ color: '#999', fontSize: '20px' }}>⇄</span>
          <button
            onClick={() => mode !== 'from_imcs' && toggleMode()}
            style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: 'clamp(14px, 3.5vw, 17px)',
              fontWeight: 'bold',
              padding: '6px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: mode === 'from_imcs' ? '#00bfff' : '#999',
              textDecoration: mode === 'from_imcs' ? 'underline' : 'none',
              textDecorationColor: '#00bfff',
              textUnderlineOffset: '8px',
              textDecorationThickness: '4px',
              transition: 'color 0.2s',
            }}
          >
            savant 2 normie
          </button>
        </div>

        {/* Translator Panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}>
          {/* Input Panel */}
          <div style={{
            padding: '22px',
            border: '3px solid #000',
            background: '#fff',
            borderRadius: HAND_DRAWN_LEFT,
            boxShadow: '8px 8px 0 rgba(0,0,0,1)',
            position: 'relative',
            minHeight: '220px',
          }}>
            <div style={{
              position: 'absolute',
              top: '-16px',
              left: '-12px',
              background: '#fff',
              border: '2px solid #000',
              padding: '2px 14px',
              transform: 'rotate(-3deg)',
              fontFamily: "'Comic Neue', cursive",
              fontSize: '16px',
              fontWeight: 'bold',
            }}>
              {mode === 'to_imcs' ? 'normie' : 'savant'}
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={mode === 'to_imcs' ? 'type normally here...' : 'paste savant speek here...'}
              maxLength={1000}
              spellCheck={false}
              style={{
                width: '100%',
                height: '190px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                outline: 'none',
                resize: 'none',
                fontFamily: "'Comic Neue', cursive",
                fontSize: '15px',
                lineHeight: '1.6',
                color: '#000',
              }}
            />
          </div>

          {/* Output Panel */}
          <div style={{
            padding: '22px',
            border: '3px solid #000',
            background: '#fff',
            borderRadius: HAND_DRAWN_RIGHT,
            boxShadow: '8px 8px 0 rgba(0,0,0,1)',
            position: 'relative',
            minHeight: '220px',
          }}>
            <div style={{
              position: 'absolute',
              top: '-16px',
              right: '-12px',
              background: '#ff00ff',
              color: '#fff',
              border: '2px solid #000',
              padding: '2px 14px',
              transform: 'rotate(3deg)',
              fontFamily: "'Comic Neue', cursive",
              fontSize: '16px',
              fontWeight: 'bold',
            }}>
              {mode === 'to_imcs' ? 'savant' : 'normie'}
            </div>

            <div style={{ minHeight: '190px', paddingTop: '8px' }}>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingTop: '80px',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['#ff69b4', '#00bfff', '#ffd700'].map((color, i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -10, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: color,
                            border: '2px solid #000',
                          }}
                        />
                      ))}
                    </div>
                    <span style={{
                      fontFamily: "'Comic Neue', cursive",
                      fontSize: '16px',
                      fontWeight: 'bold',
                      fontStyle: 'italic',
                    }}>
                      thinking hard...
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="output"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      fontFamily: "'Comic Neue', cursive",
                      fontSize: '15px',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      color: mode === 'to_imcs' ? '#000' : '#2563eb',
                    }}
                  >
                    {outputText || (
                      <span style={{ color: '#ddd' }}>
                        waiting 4 vybes...
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {outputText && (
              <button
                onClick={copyOutput}
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  background: '#c8ffc8',
                  border: '2px solid #000',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontFamily: "'Comic Neue', cursive",
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {copied ? '✓ copied!' : '📋 copy it'}
              </button>
            )}
          </div>
        </div>

        {/* Translate Button */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.05, rotate: -1 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading || !inputText.trim()}
            onClick={translate}
            style={{
              padding: '12px 40px',
              background: isLoading || !inputText.trim() ? '#ccc' : '#ff69b4',
              color: isLoading || !inputText.trim() ? '#999' : '#fff',
              fontFamily: "'Comic Neue', cursive",
              fontSize: 'clamp(18px, 4vw, 26px)',
              fontWeight: 900,
              border: '4px solid #000',
              borderRadius: HAND_DRAWN_BUTTON,
              boxShadow: '8px 8px 0 rgba(0,0,0,1)',
              cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            <span>⚡</span>
            <span>{mode === 'to_imcs' ? 'trunslate' : 'translate'}</span>
          </motion.button>
        </div>

        {/* Scribbles footer */}
        <div style={{
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '3px solid rgba(0,0,0,0.08)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px 30px',
          justifyContent: 'center',
          opacity: 0.12,
          pointerEvents: 'none',
          fontStyle: 'italic',
          fontFamily: "'Comic Neue', cursive",
          fontSize: '14px',
        }}>
          {decorativeTexts.map((item, i) => (
            <span key={i} style={{
              transform: `rotate(${item.rotate}deg)`,
              color: item.color,
              display: 'inline-block',
            }}>
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
