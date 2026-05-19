import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { IQ_TASKS, campaignToTask, EngagementCampaign } from '@/lib/iq-tasks'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { getAddress } from 'viem'

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

  const [completionsResult, discordResult, campaignsResult] = await Promise.all([
    supabase
      .from('iq_task_completions')
      .select('task_type, iq_awarded, metadata, completed_at')
      .eq('wallet_address', wallet),
    supabase
      .from('discord_wallets')
      .select('discord_user_id')
      .eq('wallet_address', getAddress(wallet))
      .single(),
    supabase
      .from('x_engagement_campaigns')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const completionMap = new Map(
    (completionsResult.data || []).map(c => [c.task_type, c])
  )

  const discordLinked = !!discordResult.data
  const discordUserId = discordResult.data?.discord_user_id || null

  let discordUsername: string | null = null
  if (discordUserId) {
    const { data: verification } = await supabase
      .from('discord_verifications')
      .select('discord_username')
      .eq('discord_user_id', discordUserId)
      .single()
    discordUsername = verification?.discord_username || null
  }

  // Check if X is linked (needed for engagement task eligibility)
  const xLinked = completionMap.has('link_x')

  // Build static tasks
  const staticTasks = IQ_TASKS.map(task => {
    const completion = completionMap.get(task.id)

    if (completion) {
      return {
        ...task,
        status: 'completed' as const,
        completed_at: completion.completed_at,
        metadata: completion.metadata,
      }
    }

    if (task.id === 'link_discord' && discordLinked) {
      return {
        ...task,
        status: 'claimable' as const,
        completed_at: null,
        metadata: { discord_username: discordUsername, discord_user_id: discordUserId },
      }
    }

    return {
      ...task,
      status: 'not_started' as const,
      completed_at: null,
      metadata: null,
    }
  })

  // Build engagement campaign tasks
  const campaigns = (campaignsResult.data || []) as EngagementCampaign[]
  const now = new Date()

  const engagementTasks = campaigns
    .filter(c => !c.expires_at || new Date(c.expires_at) > now)
    .map(campaign => {
      const taskDef = campaignToTask(campaign)
      const completion = completionMap.get(taskDef.id)

      if (completion) {
        return {
          ...taskDef,
          status: 'completed' as const,
          completed_at: completion.completed_at,
          metadata: completion.metadata,
          paused: false,
        }
      }

      return {
        ...taskDef,
        status: 'not_started' as const,
        completed_at: null,
        metadata: null,
        requires_x: !xLinked,
        paused: !campaign.active,
      }
    })

  const tasks = [...staticTasks, ...engagementTasks]

  return NextResponse.json({ tasks, discord: discordLinked ? { username: discordUsername } : null })
}
