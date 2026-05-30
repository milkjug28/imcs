// One-time heal: floor total_earned at each wallet's stable base
// (latest snapshot leaderboard_iq + bonus_iq + task IQ + pack IQ).
// Removes negative-trading drag from stored earned so underwater wallets recover to
// available = max(0, stableBase - allocated). Idempotent. Dry-run unless --save.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

for (const file of ['.env', '.env.local']) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SAVE = process.argv.includes('--save')

async function pageAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = []
  let page = 0
  const size = 1000
  while (true) {
    const { data, error } = await supabase.from(table).select(cols).range(page * size, (page + 1) * size - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < size) break
    page++
  }
  return out
}

async function run() {
  console.log(`=== HEAL IQ STABLE FLOOR ${SAVE ? '(SAVE)' : '(dry run)'} ===\n`)

  const balances = await pageAll<{ wallet: string; total_earned: number; total_allocated: number }>(
    'wallet_iq_balances', 'wallet, total_earned, total_allocated'
  )

  // latest snapshot leaderboard_iq + bonus_iq per wallet
  const snaps = await pageAll<{ wallet: string; leaderboard_iq: number; bonus_iq: number; created_at: string }>(
    'wallet_iq_snapshots', 'wallet, leaderboard_iq, bonus_iq, created_at'
  )
  const latestSnap = new Map<string, { lb: number; bonus: number; ts: number }>()
  for (const s of snaps) {
    const ts = new Date(s.created_at).getTime()
    const cur = latestSnap.get(s.wallet)
    if (!cur || ts > cur.ts) latestSnap.set(s.wallet, { lb: s.leaderboard_iq || 0, bonus: s.bonus_iq || 0, ts })
  }

  const tasks = await pageAll<{ wallet_address: string; iq_awarded: number }>(
    'iq_task_completions', 'wallet_address, iq_awarded'
  )
  const taskByWallet = new Map<string, number>()
  for (const t of tasks) taskByWallet.set(t.wallet_address, (taskByWallet.get(t.wallet_address) || 0) + (t.iq_awarded || 0))

  const packs = await pageAll<{ wallet_address: string; iq_awarded: number }>(
    'pack_rips', 'wallet_address, iq_awarded'
  )
  const packByWallet = new Map<string, number>()
  for (const p of packs) packByWallet.set(p.wallet_address, (packByWallet.get(p.wallet_address) || 0) + (p.iq_awarded || 0))

  let changed = 0
  const updates: { wallet: string; from: number; to: number; allocated: number }[] = []
  for (const b of balances) {
    const snap = latestSnap.get(b.wallet)
    if (!snap) continue // no snapshot base to floor against; leave untouched
    const stableBase = snap.lb + snap.bonus + (taskByWallet.get(b.wallet) || 0) + (packByWallet.get(b.wallet) || 0)
    const target = Math.max(b.total_earned, stableBase)
    if (target !== b.total_earned) {
      updates.push({ wallet: b.wallet, from: b.total_earned, to: target, allocated: b.total_allocated })
      changed++
    }
  }

  updates.sort((a, b) => (a.from - a.allocated) - (b.from - b.allocated))
  for (const u of updates) {
    const avBefore = Math.max(0, u.from - u.allocated)
    const avAfter = Math.max(0, u.to - u.allocated)
    console.log(`${u.wallet}  earned ${String(u.from).padStart(6)} -> ${String(u.to).padStart(5)}  alloc=${String(u.allocated).padStart(4)}  avail ${avBefore} -> ${avAfter}`)
  }
  console.log(`\nWallets to heal: ${changed} / ${balances.length}`)

  if (!SAVE) {
    console.log('\nDry run. Pass --save to write.')
    return
  }

  let done = 0
  for (const u of updates) {
    const { error } = await supabase
      .from('wallet_iq_balances')
      .update({ total_earned: u.to, updated_at: new Date().toISOString() })
      .eq('wallet', u.wallet)
    if (error) { console.error(`  FAILED ${u.wallet}:`, error.message); continue }
    done++
  }
  console.log(`\nHealed ${done}/${changed} wallets.`)
}

run().catch(console.error)
