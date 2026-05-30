// READ-ONLY audit of wallet_iq_balances. No writes. Shows allocation/stranding state.
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

type Bal = { wallet: string; total_earned: number; total_allocated: number; available: number }

async function run() {
  // page through all balances
  const all: Bal[] = []
  let page = 0
  const size = 1000
  while (true) {
    const { data, error } = await supabase
      .from('wallet_iq_balances')
      .select('wallet, total_earned, total_allocated, available')
      .range(page * size, (page + 1) * size - 1)
    if (error) { console.error(error); return }
    if (!data || data.length === 0) break
    all.push(...data as Bal[])
    if (data.length < size) break
    page++
  }

  const allocated = all.filter(b => b.total_allocated > 0)
  const stranded = allocated.filter(b => b.total_earned - b.total_allocated < 0)
  const negEarned = all.filter(b => b.total_earned < 0)
  const underwater = all.filter(b => b.total_earned - b.total_allocated < 0)
  const sumUnderwater = underwater.reduce((s, b) => s + (b.total_earned - b.total_allocated), 0)

  console.log(`\n=== IQ BALANCE AUDIT (read-only) ===`)
  console.log(`Total wallet_iq_balances rows: ${all.length}`)
  console.log(`Ever allocated (total_allocated>0): ${allocated.length}`)
  console.log(`Stranded (allocated AND earned-allocated<0): ${stranded.length}`)
  console.log(`Negative total_earned: ${negEarned.length}`)
  console.log(`Underwater (earned-allocated<0, any): ${underwater.length}`)
  console.log(`Total underwater IQ: ${sumUnderwater}`)

  const fmt = (b: Bal) => {
    const gap = b.total_earned - b.total_allocated
    // proposed heal: available floors at 0; earned stays truthful. heal_needed = how far below 0.
    return `  ${b.wallet}  earned=${String(b.total_earned).padStart(6)}  alloc=${String(b.total_allocated).padStart(5)}  gap=${String(gap).padStart(6)}  -> available_after_fix=${Math.max(0, gap)}`
  }

  console.log(`\n--- STRANDED (allocated, now underwater) [${stranded.length}] ---`)
  stranded.sort((a, b) => (a.total_earned - a.total_allocated) - (b.total_earned - b.total_allocated))
  stranded.forEach(b => console.log(fmt(b)))

  console.log(`\n--- NEGATIVE total_earned [${negEarned.length}] ---`)
  negEarned.sort((a, b) => a.total_earned - b.total_earned)
  negEarned.forEach(b => console.log(fmt(b)))

  const underwaterNoAlloc = underwater.filter(b => b.total_allocated === 0)
  console.log(`\n--- UNDERWATER but never allocated [${underwaterNoAlloc.length}] (these just need available floored; no allocation at risk) ---`)
  underwaterNoAlloc.sort((a, b) => a.total_earned - b.total_earned)
  underwaterNoAlloc.forEach(b => console.log(fmt(b)))
}

run().catch(console.error)
