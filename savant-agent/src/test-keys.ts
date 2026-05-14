import { config } from './config'

const models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']

async function testAllKeys() {
  for (let ki = 0; ki < config.geminiKeys.length; ki++) {
    const key = config.geminiKeys[ki]
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'hi' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      })
      const status = res.status === 200 ? 'OK' : `${res.status}`
      console.log(`K${ki + 1} ${model}: ${status}`)
    }
  }
}

testAllKeys().catch(console.error)
