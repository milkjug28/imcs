import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { IQ_TASKS } from '@/lib/iq-tasks'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`iq-tasks:${ip}`, { limit: 30, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase()
  if (!wallet) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }

  const { data: completions } = await supabase
    .from('iq_task_completions')
    .select('task_type, iq_awarded, metadata, completed_at')
    .eq('wallet_address', wallet)

  const completionMap = new Map(
    (completions || []).map(c => [c.task_type, c])
  )

  const tasks = IQ_TASKS.map(task => ({
    ...task,
    completed: completionMap.has(task.id),
    completed_at: completionMap.get(task.id)?.completed_at || null,
    metadata: completionMap.get(task.id)?.metadata || null,
  }))

  return NextResponse.json({ tasks })
}
