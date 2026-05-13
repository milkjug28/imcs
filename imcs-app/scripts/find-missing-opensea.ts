import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.+)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
}

const API_KEY = env.OPENSEA_API_KEY
const CONTRACT = '0x95fa6fc553F5bE3160b191b0133236367A835C63'
const TOTAL_SUPPLY = 4269

async function checkToken(tokenId: number): Promise<boolean> {
  const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${CONTRACT}/nfts/${tokenId}`
  const res = await fetch(url, {
    headers: { 'x-api-key': API_KEY },
  })
  if (res.status === 404 || res.status === 400) return false
  if (!res.ok) {
    console.log(`  Token ${tokenId}: HTTP ${res.status} (retrying...)`)
    await new Promise(r => setTimeout(r, 2000))
    return checkToken(tokenId)
  }
  return true
}

async function findMissing() {
  const missing: number[] = []
  console.log(`Scanning from ${TOTAL_SUPPLY} downward, looking for 5 missing tokens...\n`)

  for (let id = TOTAL_SUPPLY; id >= 1 && missing.length < 5; id--) {
    const exists = await checkToken(id)
    if (!exists) {
      console.log(`MISSING: Token #${id}`)
      missing.push(id)
    } else if (id % 100 === 0) {
      console.log(`  Checked down to #${id}... (${missing.length} missing so far)`)
    }
    // rate limit
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nFound ${missing.length} missing tokens:`, missing)
}

findMissing()
