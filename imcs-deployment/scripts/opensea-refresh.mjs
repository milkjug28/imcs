// Forces OpenSea to re-index metadata for every trait token id + the pack.
// OpenSea lazily indexes 1155 ids; this nudges each one via the v2 refresh API.
// Env (imcs-deployment/.env): OPENSEA_API_KEY, EQUIPMENT_ADDRESS
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function loadEnv() {
  const p = join(ROOT, '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const KEY = process.env.OPENSEA_API_KEY
const ADDR = (process.env.EQUIPMENT_ADDRESS || '').toLowerCase()
const PACK = Number(process.env.PACK_TOKEN_ID || 999000)
const CHAIN = 'base'
if (!KEY) throw new Error('OPENSEA_API_KEY unset')
if (!ADDR) throw new Error('EQUIPMENT_ADDRESS unset')

const map = JSON.parse(readFileSync(join(ROOT, 'data', 'trait-map.json'), 'utf8'))
const traits = map.traits || map
const ids = Object.keys(traits).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
ids.push(PACK)

const sleep = ms => new Promise(r => setTimeout(r, ms))
let ok = 0, fail = 0
console.log(`refreshing ${ids.length} ids on ${CHAIN}/${ADDR}`)

for (const id of ids) {
  const url = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${ADDR}/nfts/${id}/refresh`
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'X-API-KEY': KEY, accept: 'application/json' } })
    if (res.ok) { ok++; process.stdout.write(`  ${id} ok\n`) }
    else {
      fail++
      const body = await res.text().catch(() => '')
      process.stdout.write(`  ${id} HTTP ${res.status} ${body.slice(0, 80)}\n`)
      if (res.status === 429) { console.log('  rate limited, backing off 5s'); await sleep(5000) }
    }
  } catch (e) { fail++; process.stdout.write(`  ${id} ERR ${e.message}\n`) }
  await sleep(350)
}
console.log(`done: ${ok} ok, ${fail} fail`)
