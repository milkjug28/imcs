import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '50'), 100)

  let query = supabase
    .from('chat_messages')
    .select('id, wallet_address, username, message, is_bot, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (since) {
    query = query.gt('created_at', since)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  return NextResponse.json({ messages: (data || []).reverse() })
}
