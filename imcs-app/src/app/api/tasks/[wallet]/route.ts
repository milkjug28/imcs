import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    // Rate limit: 30 requests per minute per IP
    const ip = getRequestIP(request)
    const rl = rateLimit(`tasks:${ip}`, { limit: 30, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'slow down dummie' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const wallet = params.wallet.toLowerCase()

    // Query task_completions table (including completion_count)
    const { data: tasks, error } = await supabase
      .from('task_completions')
      .select('task_type, score, completion_count, completed_at')
      .eq('wallet_address', wallet)
      .order('completed_at', { ascending: false })

    if (error) {
      // Table might not exist yet - return empty array
      console.error('Task completions query error:', error)
      return NextResponse.json({ tasks: [] })
    }

    // Ensure completion_count has a default value
    const tasksWithCount = (tasks || []).map(t => ({
      ...t,
      completion_count: t.completion_count || 1
    }))

    return NextResponse.json({ tasks: tasksWithCount }, {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Tasks fetch error:', error)
    return NextResponse.json(
      { error: 'failed to fetch tasks', tasks: [] },
      { status: 500 }
    )
  }
}
