import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function analyzePoints() {
  console.log('Fetching all submissions...')
  const { data: allSubmissions, error: submissionsError } = await supabase
    .from('submissions')
    .select('wallet_address, name, score, ip_address')
  if (submissionsError) {
    console.error('Leaderboard submissions error:', submissionsError)
    return
  }

  const { data: taskCompletions } = await supabase.from('task_completions').select('wallet_address, score')
  const taskPointsMap = new Map<string, number>()
  if (taskCompletions) {
    for (const task of taskCompletions) {
      const wallet = task.wallet_address.toLowerCase()
      taskPointsMap.set(wallet, (taskPointsMap.get(wallet) || 0) + (task.score || 0))
    }
  }

  const ipToWalletMap = new Map<string, string>()
  if (allSubmissions) {
    for (const sub of allSubmissions) {
      if (sub.ip_address) {
        ipToWalletMap.set(sub.ip_address, sub.wallet_address.toLowerCase())
      }
    }
  }

  const { data: walletVotes } = await supabase.from('votes').select('voter_identifier').like('voter_identifier', '0x%')
  const votingKarmaMap = new Map<string, number>()
  if (walletVotes) {
    for (const vote of walletVotes) {
      const wallet = vote.voter_identifier.toLowerCase()
      votingKarmaMap.set(wallet, (votingKarmaMap.get(wallet) || 0) + 1)
    }
  }

  const { data: ipVotes } = await supabase.from('votes').select('voter_identifier').not('voter_identifier', 'like', '0x%')
  if (ipVotes) {
    for (const vote of ipVotes) {
      const wallet = ipToWalletMap.get(vote.voter_identifier)
      if (wallet) {
        votingKarmaMap.set(wallet, (votingKarmaMap.get(wallet) || 0) + 1)
      }
    }
  }

  type UserEntry = { wallet: string; name: string; total: number; sub: number; task: number; vote: number }
  const users: UserEntry[] = []
  const walletsSeen = new Set<string>()

  if (allSubmissions) {
    for (const sub of allSubmissions) {
      const wallet = sub.wallet_address.toLowerCase()
      walletsSeen.add(wallet)
      const taskPoints = taskPointsMap.get(wallet) || 0
      const votingKarma = votingKarmaMap.get(wallet) || 0
      const submissionScore = Number(sub.score) || 0
      users.push({
        wallet,
        name: sub.name || 'Unknown',
        total: submissionScore + votingKarma + taskPoints,
        sub: submissionScore,
        task: taskPoints,
        vote: votingKarma,
      })
    }
  }

  const allWalletsWithPoints = new Set<string>([...taskPointsMap.keys(), ...votingKarmaMap.keys()])
  for (const wallet of allWalletsWithPoints) {
    if (!walletsSeen.has(wallet)) {
      const taskPoints = taskPointsMap.get(wallet) || 0
      const votingKarma = votingKarmaMap.get(wallet) || 0
      const totalPoints = votingKarma + taskPoints
      if (totalPoints > 0) {
        users.push({ wallet, name: 'Anonymous', total: totalPoints, sub: 0, task: taskPoints, vote: votingKarma })
      }
    }
  }

  users.sort((a, b) => b.total - a.total)

  const MIN_WL = 1017

  console.log(`\n--- TOP 20 USERS ---`)
  console.log(`${'#'.padStart(3)} | ${'TOTAL'.padStart(6)} | ${'SUB'.padStart(5)} | ${'TASK'.padStart(5)} | ${'VOTE'.padStart(5)} | ${'WL?'.padStart(4)} | NAME`)
  console.log('-'.repeat(70))
  for (let i = 0; i < Math.min(20, users.length); i++) {
    const u = users[i]
    const wl = u.total >= MIN_WL ? ' ✅' : ' ❌'
    console.log(
      `${(i + 1).toString().padStart(3)} | ${u.total.toString().padStart(6)} | ${u.sub.toString().padStart(5)} | ${u.task.toString().padStart(5)} | ${u.vote.toString().padStart(5)} | ${wl} | ${u.name} (${u.wallet.slice(0, 8)}...)`
    )
  }

  const aboveThreshold = users.filter(u => u.total >= MIN_WL).length
  console.log(`\n--- SUMMARY (threshold: ${MIN_WL}) ---`)
  console.log(`Users >= ${MIN_WL} pts: ${aboveThreshold}`)
  console.log(`Users < ${MIN_WL} pts: ${users.length - aboveThreshold}`)
  console.log(`Total users: ${users.length}`)
}

analyzePoints()
