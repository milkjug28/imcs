/**
 * Mint Phase Import Script
 *
 * Three modes:
 *   --collab    Import add-to-gtd-fcfs.csv → gtd + fcfs, source='collab'
 *   --leaderboard  Scan leaderboard_scores → above threshold get gtd + fcfs, below get fcfs only
 *   --snapshot <file.csv>  Import holder snapshot → community + fcfs, source='snapshot'
 *   --all       Run collab + leaderboard together
 *
 * Usage:
 *   source .env.local && npx tsx scripts/import-mint-phases.ts --collab
 *   source .env.local && npx tsx scripts/import-mint-phases.ts --leaderboard
 *   source .env.local && npx tsx scripts/import-mint-phases.ts --snapshot ../../snapshot.csv
 *   source .env.local && npx tsx scripts/import-mint-phases.ts --all
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const THRESHOLD = 1017

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Run: source .env.local && npx tsx scripts/import-mint-phases.ts --collab')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function parseWalletCsv(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const seen = new Set<string>()
  const wallets: string[] = []
  let skipped = 0

  for (const line of lines) {
    let wallet = line.replace(/,+$/, '').trim()
    wallet = wallet.replace(/^0X/, '0x')
    wallet = wallet.replace(/[.\s]+$/, '')

    const lower = wallet.toLowerCase()

    if (!/^0x[a-f0-9]{40}$/i.test(wallet)) {
      if (line.toLowerCase().includes('wallet') || line.toLowerCase().includes('address')) continue
      console.warn(`  SKIP invalid: ${line}`)
      skipped++
      continue
    }

    if (seen.has(lower)) {
      skipped++
      continue
    }

    seen.add(lower)
    wallets.push(lower)
  }

  console.log(`Parsed ${lines.length} lines → ${wallets.length} unique valid wallets (${skipped} skipped)`)
  return wallets
}

interface PhaseUpdate {
  wallet: string
  gtd?: boolean
  community?: boolean
  fcfs?: boolean
  source: string
}

async function upsertPhases(updates: PhaseUpdate[]) {
  let inserted = 0
  let updated = 0
  let failed = 0

  for (const u of updates) {
    const { data: existing } = await supabase
      .from('whitelist')
      .select('id, gtd, community, fcfs, source')
      .eq('wallet_address', u.wallet)
      .single()

    if (existing) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (u.gtd) patch.gtd = true
      if (u.community) patch.community = true
      if (u.fcfs) patch.fcfs = true
      if (!existing.source) patch.source = u.source

      const { error } = await supabase
        .from('whitelist')
        .update(patch)
        .eq('wallet_address', u.wallet)

      if (error) {
        console.error(`  UPDATE failed ${u.wallet}: ${error.message}`)
        failed++
      } else {
        updated++
      }
    } else {
      const { error } = await supabase
        .from('whitelist')
        .insert({
          wallet_address: u.wallet,
          status: 'approved',
          method: u.source === 'collab' ? 'collab' : u.source === 'snapshot' ? 'collab' : 'auto_points',
          gtd: u.gtd || false,
          community: u.community || false,
          fcfs: u.fcfs || false,
          source: u.source,
        })

      if (error) {
        console.error(`  INSERT failed ${u.wallet}: ${error.message}`)
        failed++
      } else {
        inserted++
      }
    }
  }

  return { inserted, updated, failed }
}

async function importCollab() {
  console.log('\n=== COLLAB IMPORT (add-to-gtd-fcfs.csv) ===')
  const csvPath = path.resolve(__dirname, '../../add-to-gtd-fcfs.csv')
  const wallets = parseWalletCsv(csvPath)

  const updates: PhaseUpdate[] = wallets.map(w => ({
    wallet: w,
    gtd: true,
    fcfs: true,
    source: 'collab',
  }))

  const result = await upsertPhases(updates)
  console.log(`Collab: ${result.inserted} inserted, ${result.updated} updated, ${result.failed} failed`)
  return result
}

async function importLeaderboard() {
  console.log('\n=== LEADERBOARD PHASE ASSIGNMENT ===')

  const { data: aboveThreshold, error: e1 } = await supabase
    .from('leaderboard_scores')
    .select('wallet_address, total_points')
    .gte('total_points', THRESHOLD)

  if (e1) { console.error('Failed to query above threshold:', e1); return }
  console.log(`Above threshold (>= ${THRESHOLD}): ${aboveThreshold!.length} wallets → gtd + fcfs`)

  const { data: belowThreshold, error: e2 } = await supabase
    .from('leaderboard_scores')
    .select('wallet_address, total_points')
    .gt('total_points', 0)
    .lt('total_points', THRESHOLD)

  if (e2) { console.error('Failed to query below threshold:', e2); return }
  console.log(`Below threshold (> 0, < ${THRESHOLD}): ${belowThreshold!.length} wallets → fcfs only`)

  const updates: PhaseUpdate[] = [
    ...aboveThreshold!.map(w => ({
      wallet: w.wallet_address.toLowerCase(),
      gtd: true,
      fcfs: true,
      source: 'leaderboard',
    })),
    ...belowThreshold!.map(w => ({
      wallet: w.wallet_address.toLowerCase(),
      fcfs: true,
      source: 'leaderboard',
    })),
  ]

  const result = await upsertPhases(updates)
  console.log(`Leaderboard: ${result.inserted} inserted, ${result.updated} updated, ${result.failed} failed`)
  return result
}

async function importSnapshot(csvFile: string) {
  console.log(`\n=== SNAPSHOT IMPORT (${csvFile}) ===`)
  const csvPath = path.resolve(csvFile)
  const wallets = parseWalletCsv(csvPath)

  const updates: PhaseUpdate[] = wallets.map(w => ({
    wallet: w,
    community: true,
    fcfs: true,
    source: 'snapshot',
  }))

  const result = await upsertPhases(updates)
  console.log(`Snapshot: ${result.inserted} inserted, ${result.updated} updated, ${result.failed} failed`)
  return result
}

async function printSummary() {
  console.log('\n=== PHASE SUMMARY ===')

  const { count: gtdCount } = await supabase.from('whitelist').select('*', { count: 'exact', head: true }).eq('gtd', true)
  const { count: communityCount } = await supabase.from('whitelist').select('*', { count: 'exact', head: true }).eq('community', true)
  const { count: fcfsCount } = await supabase.from('whitelist').select('*', { count: 'exact', head: true }).eq('fcfs', true)
  const { count: totalCount } = await supabase.from('whitelist').select('*', { count: 'exact', head: true })

  console.log(`GTD wallets:       ${gtdCount}`)
  console.log(`Community wallets: ${communityCount}`)
  console.log(`FCFS wallets:      ${fcfsCount}`)
  console.log(`Total in whitelist: ${totalCount}`)
  console.log('')
  console.log('Max theoretical mints (100% participation):')
  console.log(`  GTD phase:       ${gtdCount}`)
  console.log(`  Community phase: ${communityCount}`)
  console.log(`  FCFS phase:      ${fcfsCount}`)
  console.log(`  TOTAL:           ${(gtdCount || 0) + (communityCount || 0) + (fcfsCount || 0)}`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('Usage:')
    console.log('  --collab       Import add-to-gtd-fcfs.csv')
    console.log('  --leaderboard  Assign phases from leaderboard scores')
    console.log('  --snapshot <file.csv>  Import holder snapshot')
    console.log('  --all          Run collab + leaderboard')
    console.log('  --summary      Print phase counts')
    process.exit(0)
  }

  if (args.includes('--collab') || args.includes('--all')) {
    await importCollab()
  }

  if (args.includes('--leaderboard') || args.includes('--all')) {
    await importLeaderboard()
  }

  const snapshotIdx = args.indexOf('--snapshot')
  if (snapshotIdx !== -1) {
    const file = args[snapshotIdx + 1]
    if (!file) {
      console.error('--snapshot requires a CSV file path')
      process.exit(1)
    }
    await importSnapshot(file)
  }

  await printSummary()
}

main().catch(console.error)
