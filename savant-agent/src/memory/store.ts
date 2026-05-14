import { supabase } from '../data/supabase'
import { log, logError } from '../utils/log'
import type { AgentMemory, MemoryType } from './types'

export async function recallMemory(query: string, subject?: string): Promise<AgentMemory[]> {
  try {
    let q = supabase
      .from('agent_memory')
      .select('*')
      .ilike('content', `%${query}%`)
      .order('salience', { ascending: false })
      .order('last_accessed', { ascending: false })
      .limit(5)

    if (subject) {
      q = q.eq('subject', subject)
    }

    const { data, error } = await q

    if (error || !data || data.length === 0) return []

    const ids = data.map((m: AgentMemory) => m.id)
    await supabase
      .from('agent_memory')
      .update({ access_count: data[0].access_count + 1, last_accessed: new Date().toISOString() })
      .in('id', ids)

    log(`[memory] recalled ${data.length} memories for "${query}"`)
    return data as AgentMemory[]
  } catch (err) {
    logError('[memory] recall failed', err)
    return []
  }
}

export async function saveMemory(
  memoryType: MemoryType,
  content: string,
  subject?: string,
  salience?: number,
): Promise<boolean> {
  try {
    let existingQuery = supabase
      .from('agent_memory')
      .select('id, salience, content')
      .eq('memory_type', memoryType)
      .ilike('content', `%${content.slice(0, 50)}%`)
      .limit(1)

    if (subject) {
      existingQuery = existingQuery.eq('subject', subject)
    }

    const { data: existing } = await existingQuery

    if (existing && existing.length > 0) {
      const current = existing[0]
      const newSalience = Math.min(1, (current.salience || 0.5) + 0.1)
      await supabase
        .from('agent_memory')
        .update({
          content,
          salience: newSalience,
          last_accessed: new Date().toISOString(),
        })
        .eq('id', current.id)

      log(`[memory] reinforced: "${content.slice(0, 50)}..." (salience: ${newSalience.toFixed(2)})`)
      return true
    }

    const { error } = await supabase
      .from('agent_memory')
      .insert({
        memory_type: memoryType,
        content,
        subject: subject || null,
        salience: salience ?? 0.5,
      })

    if (error) {
      logError('[memory] save failed', error)
      return false
    }

    log(`[memory] saved: "${content.slice(0, 50)}..." (type: ${memoryType}, subject: ${subject || 'none'})`)
    return true
  } catch (err) {
    logError('[memory] save failed', err)
    return false
  }
}

export async function decayMemories(): Promise<void> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Decay untouched memories
    const { count: decayed } = await supabase.rpc('decay_agent_memories', {
      cutoff_date: sevenDaysAgo,
      decay_factor: 0.95,
    }).single()

    // Prune very stale low-salience memories
    const { count: pruned } = await supabase
      .from('agent_memory')
      .delete()
      .lt('salience', 0.05)
      .lt('last_accessed', thirtyDaysAgo)

    log(`[memory] decay: ${decayed ?? 0} decayed, ${pruned ?? 0} pruned`)
  } catch (err) {
    // Fallback if RPC doesn't exist - do it with two queries
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: stale } = await supabase
        .from('agent_memory')
        .select('id, salience')
        .lt('last_accessed', sevenDaysAgo)

      if (stale && stale.length > 0) {
        for (const m of stale) {
          await supabase
            .from('agent_memory')
            .update({ salience: Math.max(0, (m.salience || 0.5) * 0.95) })
            .eq('id', m.id)
        }
      }

      await supabase
        .from('agent_memory')
        .delete()
        .lt('salience', 0.05)
        .lt('last_accessed', thirtyDaysAgo)

      log(`[memory] decay fallback: ${stale?.length ?? 0} decayed`)
    } catch (innerErr) {
      logError('[memory] decay failed', innerErr)
    }
  }
}
