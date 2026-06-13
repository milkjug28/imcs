// Targeted OpenSea metadata refresh for tokens that have allocated IQ.
// Backfills the stale IQ trait for savants allocated before the allocate-route
// OS-refresh fix. Two workers, one per API key, 3.5s spacing each.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = {}
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf-8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.+)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const KEYS = [env.OPENSEA_API_KEY, env.OPENSEA_API_KEY_2].filter(Boolean)
const CONTRACT = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const CHAIN = 'ethereum'
const DELAY_MS = 3500

const sleep = ms => new Promise(r => setTimeout(r, ms))
const ts = () => new Date().toISOString().slice(11, 19)

async function refresh(tokenId, apiKey) {
  const url = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${CONTRACT}/nfts/${tokenId}/refresh`
  const res = await fetch(url, { method: 'POST', headers: { 'x-api-key': apiKey } })
  return { ok: res.ok, status: res.status }
}

async function worker(id, apiKey, tokens) {
  const failed = []
  let success = 0
  for (let i = 0; i < tokens.length; i++) {
    const tokenId = tokens[i]
    let retries = 0, lastStatus = 0, done = false
    while (retries <= 3) {
      try {
        const { ok, status } = await refresh(tokenId, apiKey)
        lastStatus = status
        if (ok) { success++; console.log(`[W${id}] ${i + 1}/${tokens.length} #${tokenId} OK ${ts()}`); done = true; break }
        if (status === 429) {
          const backoff = Math.min(5000 * 2 ** retries, 60000)
          console.log(`[W${id}] #${tokenId} 429 backoff ${backoff / 1000}s`)
          await sleep(backoff); retries++; continue
        }
        console.log(`[W${id}] #${tokenId} HTTP ${status} skip`); failed.push(tokenId); done = true; break
      } catch (err) {
        console.log(`[W${id}] #${tokenId} ERROR ${err}`); retries++; await sleep(5000)
      }
    }
    if (!done) { console.log(`[W${id}] #${tokenId} FAILED (last ${lastStatus})`); failed.push(tokenId) }
    if (i < tokens.length - 1) await sleep(DELAY_MS)
  }
  return { success, failed }
}

const { data } = await sb.from('savant_iq').select('token_id, iq_points')
const tokens = (data || []).filter(r => r.iq_points > 0).map(r => r.token_id).sort((a, b) => a - b)
console.log(`Refreshing ${tokens.length} allocated tokens across ${KEYS.length} key(s)`)

if (KEYS.length < 1) { console.error('No OPENSEA_API_KEY set'); process.exit(1) }

// Split round-robin so each worker gets an even slice.
const slices = KEYS.map(() => [])
tokens.forEach((t, i) => slices[i % KEYS.length].push(t))

const results = await Promise.all(KEYS.map((k, i) => worker(i + 1, k, slices[i])))
const totalOk = results.reduce((s, r) => s + r.success, 0)
const allFailed = results.flatMap(r => r.failed)
console.log(`\nDone. OK: ${totalOk}/${tokens.length}. Failed: ${allFailed.length}`)
if (allFailed.length) console.log('Failed tokens:', allFailed.join(', '))
