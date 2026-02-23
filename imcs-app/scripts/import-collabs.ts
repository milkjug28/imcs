/**
 * Import collab wallets from CSV file
 * 
 * Each wallet gets:
 * - 1017 bonus points via task_completions (task_type: 'collab_bonus')
 * - Whitelist status 'approved' (method: 'collab')
 * 
 * Usage: 
 *   export SUPABASE_URL=... && export SUPABASE_SERVICE_ROLE_KEY=... && npx tsx scripts/import-collabs.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const COLLAB_POINTS = 1017
const CSV_PATH = path.resolve(__dirname, '../../collab-wallets.csv')

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function importCollabs() {
  // Read and parse CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf-8')
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  // Normalize wallets: lowercase, dedupe, filter valid 0x addresses
  const seen = new Set<string>()
  const wallets: string[] = []
  let skipped = 0

  for (const line of lines) {
    // Fix common typos (e.g., "Ox" instead of "0x")
    let wallet = line.replace(/^Ox/i, '0x')
    // Remove trailing dots or other garbage
    wallet = wallet.replace(/[.\s]+$/, '')
    
    const lower = wallet.toLowerCase()
    
    if (!/^0x[a-f0-9]{40}$/i.test(wallet)) {
      console.warn(`  SKIP invalid address: ${line}`)
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

  console.log(`\nParsed ${lines.length} lines`)
  console.log(`Valid unique wallets: ${wallets.length}`)
  console.log(`Skipped (invalid/dupes): ${skipped}`)
  console.log(`Points per wallet: ${COLLAB_POINTS}`)
  console.log('')

  let wlInserted = 0
  let wlUpdated = 0
  let wlFailed = 0
  let taskInserted = 0
  let taskSkipped = 0
  let taskFailed = 0

  for (const wallet of wallets) {
    // 1. Upsert whitelist entry
    const { data: existingWl } = await supabase
      .from('whitelist')
      .select('id, status')
      .eq('wallet_address', wallet)
      .single()

    if (existingWl) {
      if (existingWl.status !== 'approved') {
        const { error } = await supabase
          .from('whitelist')
          .update({ status: 'approved', method: 'collab', updated_at: new Date().toISOString() })
          .eq('wallet_address', wallet)
        if (error) {
          console.error(`  WL update failed for ${wallet}:`, error.message)
          wlFailed++
        } else {
          wlUpdated++
        }
      }
      // Already approved — skip
    } else {
      const { error } = await supabase
        .from('whitelist')
        .insert({
          wallet_address: wallet,
          status: 'approved',
          method: 'collab',
        })
      if (error) {
        console.error(`  WL insert failed for ${wallet}:`, error.message)
        wlFailed++
      } else {
        wlInserted++
      }
    }

    // 2. Insert task_completions for collab bonus (only if not already there)
    const { data: existingTask } = await supabase
      .from('task_completions')
      .select('id')
      .eq('wallet_address', wallet)
      .eq('task_type', 'collab_bonus')
      .single()

    if (existingTask) {
      taskSkipped++
      continue
    }

    const { error: taskErr } = await supabase
      .from('task_completions')
      .insert({
        wallet_address: wallet,
        task_type: 'collab_bonus',
        score: COLLAB_POINTS,
        completion_count: 1,
      })

    if (taskErr) {
      console.error(`  Task insert failed for ${wallet}:`, taskErr.message)
      taskFailed++
    } else {
      taskInserted++
    }
  }

  console.log(`\n--- RESULTS ---`)
  console.log(`Whitelist: ${wlInserted} inserted, ${wlUpdated} updated, ${wlFailed} failed`)
  console.log(`Task points: ${taskInserted} inserted, ${taskSkipped} already existed, ${taskFailed} failed`)
  console.log(`\nDone! ${wallets.length} collab wallets processed.`)
}

importCollabs().catch(console.error)
