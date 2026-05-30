// READ-ONLY. For each stranded wallet, compare allocated vs latest-snapshot stable base
// (leaderboard_iq + bonus_iq, which excludes volatile live trading) + task + pack IQ.
// Tells us if they were solvent at snapshot and only went underwater from live trading.
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

async function run() {
  const { data: bals } = await supabase
    .from('wallet_iq_balances')
    .select('wallet, total_earned, total_allocated')
  const stranded = (bals || []).filter(b => b.total_allocated > 0 && b.total_earned - b.total_allocated < 0)

  console.log(`\n=== STRANDED DETAIL [${stranded.length}] ===`)
  console.log(`wallet                                       alloc  earned(live)  snapBase(lb+bonus)  task  pack  base+task+pack  solventAtSnap?`)

  let solventCount = 0
  for (const b of stranded) {
    const [{ data: snap }, { data: tasks }, { data: packs }] = await Promise.all([
      supabase.from('wallet_iq_snapshots')
        .select('leaderboard_iq, bonus_iq, total_iq_points, trading_iq, created_at')
        .eq('wallet', b.wallet).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('iq_task_completions').select('iq_awarded').eq('wallet_address', b.wallet),
      supabase.from('pack_rips').select('iq_awarded').eq('wallet_address', b.wallet),
    ])
    const lb = snap?.leaderboard_iq ?? 0
    const bonus = snap?.bonus_iq ?? 0
    const snapBase = lb + bonus
    const taskIQ = (tasks || []).reduce((s, t) => s + (t.iq_awarded || 0), 0)
    const packIQ = (packs || []).reduce((s, p) => s + (p.iq_awarded || 0), 0)
    const stableTotal = snapBase + taskIQ + packIQ
    const solvent = stableTotal >= b.total_allocated
    if (solvent) solventCount++
    console.log(
      `${b.wallet}  ${String(b.total_allocated).padStart(5)}  ${String(b.total_earned).padStart(11)}  ${String(snapBase).padStart(17)}  ${String(taskIQ).padStart(4)}  ${String(packIQ).padStart(4)}  ${String(stableTotal).padStart(14)}  ${solvent ? 'YES' : 'no'}`
    )
  }
  console.log(`\nSolvent-at-snapshot (stable base+task+pack >= allocated): ${solventCount}/${stranded.length}`)
  console.log(`=> these went underwater purely from live trading clawback (the bug).`)
  console.log(`Not-solvent: ${stranded.length - solventCount} allocated against transient live-trading IQ that has since dropped.`)
}

run().catch(console.error)
