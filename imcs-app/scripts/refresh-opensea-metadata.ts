import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.+)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
}

const API_KEYS = [env.OPENSEA_API_KEY, env.OPENSEA_API_KEY_2].filter(Boolean)
const CONTRACT = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const CHAIN = 'ethereum'
const TOTAL_SUPPLY = 4269
const DELAY_MS = 3500
const isDryRun = process.argv.includes('--dry-run')

if (API_KEYS.length < 2) {
  console.error('Need both OPENSEA_API_KEY and OPENSEA_API_KEY_2 in .env.local')
  process.exit(1)
}

async function refreshToken(tokenId: number, apiKey: string): Promise<{ ok: boolean; status: number }> {
  const url = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${CONTRACT}/nfts/${tokenId}/refresh`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
  })
  return { ok: res.ok, status: res.status }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function timestamp() {
  return new Date().toISOString().slice(11, 19)
}

async function worker(id: number, apiKey: string, tokens: number[]) {
  const failed: number[] = []
  let success = 0

  for (let i = 0; i < tokens.length; i++) {
    const tokenId = tokens[i]
    const pct = ((i / tokens.length) * 100).toFixed(1)

    let retries = 0
    let lastStatus = 0

    while (retries <= 3) {
      try {
        const { ok, status } = await refreshToken(tokenId, apiKey)
        lastStatus = status

        if (ok) {
          success++
          console.log(`[W${id}] ${i + 1}/${tokens.length} (${pct}%) - #${tokenId} OK  ${timestamp()}`)
          break
        }

        if (status === 429) {
          const backoff = Math.min(5000 * Math.pow(2, retries), 60000)
          console.log(`[W${id}] #${tokenId} 429 - backing off ${backoff / 1000}s (retry ${retries + 1})`)
          await sleep(backoff)
          retries++
          continue
        }

        console.log(`[W${id}] #${tokenId} HTTP ${status} - skipping`)
        failed.push(tokenId)
        break
      } catch (err) {
        console.log(`[W${id}] #${tokenId} ERROR: ${err} (retry ${retries + 1})`)
        retries++
        await sleep(5000)
      }
    }

    if (retries > 3) {
      console.log(`[W${id}] #${tokenId} FAILED after retries (last status: ${lastStatus})`)
      failed.push(tokenId)
    }

    if (i < tokens.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  return { success, failed }
}

async function main() {
  console.log(`OpenSea Metadata Refresh`)
  console.log(`Contract: ${CONTRACT}`)
  console.log(`Total supply: ${TOTAL_SUPPLY}`)
  console.log(`Delay: ${DELAY_MS}ms per request per worker`)
  console.log(`Workers: ${API_KEYS.length}`)
  console.log(`Mode: ${isDryRun ? 'DRY RUN (2 tokens per worker)' : 'FULL'}\n`)

  const mid = Math.ceil(TOTAL_SUPPLY / 2)
  let worker1Tokens = Array.from({ length: mid }, (_, i) => i + 1)
  let worker2Tokens = Array.from({ length: TOTAL_SUPPLY - mid }, (_, i) => mid + i + 1)

  if (isDryRun) {
    worker1Tokens = worker1Tokens.slice(0, 2)
    worker2Tokens = worker2Tokens.slice(0, 2)
  }

  const estMinutes = Math.ceil((Math.max(worker1Tokens.length, worker2Tokens.length) * DELAY_MS) / 60000)
  console.log(`Estimated time: ~${estMinutes} minutes\n`)

  const start = Date.now()

  const [r1, r2] = await Promise.all([
    worker(1, API_KEYS[0], worker1Tokens),
    worker(2, API_KEYS[1], worker2Tokens),
  ])

  const elapsed = ((Date.now() - start) / 60000).toFixed(1)
  const allFailed = [...r1.failed, ...r2.failed].sort((a, b) => a - b)

  console.log(`\n=== Results ===`)
  console.log(`Time: ${elapsed} minutes`)
  console.log(`Worker 1: ${r1.success} OK, ${r1.failed.length} failed`)
  console.log(`Worker 2: ${r2.success} OK, ${r2.failed.length} failed`)
  console.log(`Total: ${r1.success + r2.success} OK, ${allFailed.length} failed`)

  if (allFailed.length > 0) {
    console.log(`\nFailed tokens: ${allFailed.join(', ')}`)
  }
}

main().catch(console.error)
