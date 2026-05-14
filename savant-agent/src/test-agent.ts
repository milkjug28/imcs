import { config } from './config'

const tools = [{
  functionDeclarations: [{
    name: 'check_floor_price',
    description: 'Get the current IMCS savant floor price.',
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  }]
}]

async function test() {
  const key = config.geminiKeys[0]
  if (!key) { console.error('no gemini key'); return }

  const model = 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

  // Test 1: simple text (no tools)
  console.log('--- Test 1: simple text ---')
  const res1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: 'You are a savant. Reply in 10 words max.' }] },
      contents: [{ role: 'user', parts: [{ text: 'gm' }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.95, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  const data1 = await res1.json()
  console.log('status:', res1.status)
  console.log('response:', JSON.stringify(data1, null, 2).slice(0, 500))

  // Test 2: with tools
  console.log('\n--- Test 2: with tools ---')
  const res2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: 'You are a savant. Reply in 10 words max.' }] },
      contents: [{ role: 'user', parts: [{ text: 'what is the floor price?' }] }],
      tools,
      generationConfig: { maxOutputTokens: 400, temperature: 0.95, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  const data2 = await res2.json()
  console.log('status:', res2.status)
  console.log('response:', JSON.stringify(data2, null, 2).slice(0, 500))
}

test().catch(console.error)
