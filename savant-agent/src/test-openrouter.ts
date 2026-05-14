import { config } from './config'

async function test() {
  if (!config.openRouterKey) { console.error('no OPEN_ROUTER_API_KEY'); return }

  console.log('--- Test 1: simple chat ---')
  const res1 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openRouterKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: 'Reply in 10 words max. Be a savant.' },
        { role: 'user', content: 'gm' },
      ],
      max_tokens: 100,
    }),
  })
  const data1 = await res1.json() as Record<string, unknown>
  console.log('status:', res1.status)
  const choices1 = data1.choices as { message: { content: string } }[] | undefined
  console.log('reply:', choices1?.[0]?.message?.content || JSON.stringify(data1).slice(0, 300))

  console.log('\n--- Test 2: with tools ---')
  const res2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openRouterKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: 'You are a savant. Use tools when needed.' },
        { role: 'user', content: 'what is the floor price of savants?' },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'check_floor_price',
          description: 'Get the current floor price',
          parameters: { type: 'object', properties: {} },
        },
      }],
      max_tokens: 100,
    }),
  })
  const data2 = await res2.json() as Record<string, unknown>
  console.log('status:', res2.status)
  const choices2 = data2.choices as { message: Record<string, unknown> }[] | undefined
  const msg = choices2?.[0]?.message
  if (msg?.tool_calls) {
    console.log('tool_calls:', JSON.stringify(msg.tool_calls, null, 2))
  } else {
    console.log('reply:', msg?.content || JSON.stringify(data2).slice(0, 300))
  }
}

test().catch(console.error)
