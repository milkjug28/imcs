import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { normalizeTrait } from '../src/lib/trait-normalize'

const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.+)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const METADATA_DIR = resolve(__dirname, '../data/metadata')
const TOTAL_SUPPLY = 4269

const ALL_TRAIT_TYPES = [
  "bg's", 'bods', 'cloths', 'ayezz', 'moufs', 'hatss',
  'extruhs', 'facessories', 'textuh', 'speshul',
]

type TokenTraits = {
  tokenId: number
  traits: Map<string, string>
  isOneOfOne: boolean
}

function loadAllMetadata(): TokenTraits[] {
  const files = readdirSync(METADATA_DIR).filter(f => /^\d+$/.test(f))
  const tokens: TokenTraits[] = []

  for (const file of files) {
    const content = readFileSync(resolve(METADATA_DIR, file), 'utf-8')
    const meta = JSON.parse(content)
    const attributes: { trait_type: string; value: string }[] = meta.attributes || []

    const isOneOfOne = attributes.some(a => a.trait_type === '1 of 1')
    const traits = new Map<string, string>()

    for (const attr of attributes) {
      if (attr.trait_type === '1 of 1') continue
      const normalized = normalizeTrait(attr.trait_type, attr.value)
      traits.set(attr.trait_type, normalized)
    }

    tokens.push({ tokenId: parseInt(file), traits, isOneOfOne })
  }

  return tokens
}

function computeRarity(tokens: TokenTraits[]) {
  const traitCounts = new Map<string, Map<string, number>>()
  for (const tt of ALL_TRAIT_TYPES) {
    traitCounts.set(tt, new Map())
  }

  for (const token of tokens) {
    for (const tt of ALL_TRAIT_TYPES) {
      const value = token.traits.get(tt) || 'None'
      const counts = traitCounts.get(tt)!
      counts.set(value, (counts.get(value) || 0) + 1)
    }
  }

  console.log('\n=== Trait Distribution (normalized) ===')
  for (const [tt, counts] of traitCounts) {
    console.log(`\n${tt} (${counts.size} values):`)
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    for (const [val, count] of sorted) {
      const pct = (count / TOTAL_SUPPLY * 100).toFixed(1)
      console.log(`  ${count.toString().padStart(4)}  ${val} (${pct}%)`)
    }
  }

  // Statistical rarity: -log10(product of trait probabilities)
  // Higher score = rarer (more improbable combination)
  const oneOfOnes: typeof scored = []
  const regular: typeof scored = []

  type ScoredToken = {
    tokenId: number
    score: number
    isOneOfOne: boolean
    rank: number
    traits: { trait_type: string; value: string; count: number; pct: number }[]
  }

  const scored: ScoredToken[] = []

  for (const token of tokens) {
    let logProb = 0
    const traitBreakdown: ScoredToken['traits'] = []

    for (const tt of ALL_TRAIT_TYPES) {
      const value = token.traits.get(tt) || 'None'
      const count = traitCounts.get(tt)!.get(value)!
      const pct = count / TOTAL_SUPPLY
      logProb += Math.log10(pct)

      traitBreakdown.push({
        trait_type: tt,
        value,
        count,
        pct: Math.round(pct * 10000) / 100,
      })
    }

    const score = Math.round(-logProb * 10000) / 10000

    const entry: ScoredToken = {
      tokenId: token.tokenId,
      score,
      isOneOfOne: token.isOneOfOne,
      rank: 0,
      traits: traitBreakdown,
    }

    if (token.isOneOfOne) {
      oneOfOnes.push(entry)
    } else {
      regular.push(entry)
    }
  }

  // 1-of-1s all share rank #1, rest start after
  oneOfOnes.sort((a, b) => a.tokenId - b.tokenId)
  for (const o of oneOfOnes) o.rank = 1

  regular.sort((a, b) => b.score - a.score)
  const startRank = oneOfOnes.length + 1
  for (let i = 0; i < regular.length; i++) {
    regular[i].rank = startRank + i
  }

  return [...oneOfOnes, ...regular]
}

async function upsertToSupabase(ranked: ReturnType<typeof computeRarity>) {
  console.log(`\nUpserting ${ranked.length} tokens to savant_rarity...`)

  const rows = ranked.map(r => ({
    token_id: r.tokenId,
    rank: r.rank,
    score: r.score,
    is_one_of_one: r.isOneOfOne,
    traits: r.traits,
  }))

  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('savant_rarity')
      .upsert(chunk, { onConflict: 'token_id' })
    if (error) {
      console.error(`Error at chunk ${i}:`, error)
      return false
    }
    console.log(`  ${Math.min(i + CHUNK, rows.length)} / ${rows.length}`)
  }

  return true
}

async function main() {
  console.log('Loading metadata...')
  const tokens = loadAllMetadata()
  console.log(`Loaded ${tokens.length} tokens`)

  const ranked = computeRarity(tokens)

  const oneOfOnes = ranked.filter(r => r.isOneOfOne)
  const rest = ranked.filter(r => !r.isOneOfOne)

  console.log(`\n=== 1-of-1s (all rank #1) ===`)
  for (const r of oneOfOnes) {
    console.log(`  Token ${r.tokenId} (score: ${r.score})`)
  }

  console.log('\n=== Top 20 Rarest (non 1-of-1) ===')
  for (const r of rest.slice(0, 20)) {
    console.log(`  #${r.rank} - Token ${r.tokenId} (score: ${r.score})`)
  }

  console.log('\n=== 5 Most Common ===')
  for (const r of rest.slice(-5)) {
    console.log(`  #${r.rank} - Token ${r.tokenId} (score: ${r.score})`)
  }

  const ok = await upsertToSupabase(ranked)
  if (ok) {
    console.log('\nDone! All rarity data stored in savant_rarity table.')
  } else {
    console.log('\nFailed to upsert. Check errors above.')
  }
}

main()
