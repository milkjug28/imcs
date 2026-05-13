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

async function fetchAllIndexed(): Promise<Set<number>> {
  const indexed = new Set<number>()
  let next: string | null = null
  let page = 0

  while (true) {
    page++
    let url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${CONTRACT}/nfts?limit=200`
    if (next) url += `&next=${next}`

    const res = await fetch(url, { headers: { 'x-api-key': API_KEY } })

    if (res.status === 429) {
      console.log(`  429 on page ${page}, backing off...`)
      await new Promise(r => setTimeout(r, 3000))
      continue
    }

    if (!res.ok) {
      console.log(`  HTTP ${res.status} on page ${page}, retrying...`)
      await new Promise(r => setTimeout(r, 2000))
      continue
    }

    const data = await res.json()
    const nfts = data.nfts || []

    for (const nft of nfts) {
      const id = parseInt(nft.identifier)
      if (!isNaN(id)) indexed.add(id)
    }

    console.log(`  Page ${page}: +${nfts.length} tokens (${indexed.size} total)`)

    next = data.next
    if (!next || nfts.length === 0) break

    await new Promise(r => setTimeout(r, 260))
  }

  return indexed
}

async function findMissing() {
  console.log(`Fetching all indexed tokens from OpenSea...\n`)

  const indexed = await fetchAllIndexed()

  console.log(`\nOpenSea has ${indexed.size} / ${TOTAL_SUPPLY} indexed.`)

  const missing: number[] = []
  for (let id = 1; id <= TOTAL_SUPPLY; id++) {
    if (!indexed.has(id)) missing.push(id)
  }

  console.log(`\nMissing (${missing.length}):`, missing)
}

findMissing()
