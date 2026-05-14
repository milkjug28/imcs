import { supabase } from '../data/supabase'
import { log, logError } from '../utils/log'

export async function getState<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data } = await supabase
      .from('agent_state')
      .select('value')
      .eq('key', key)
      .single()

    if (!data) return fallback
    return data.value as T
  } catch {
    return fallback
  }
}

export async function setState<T>(key: string, value: T): Promise<void> {
  try {
    await supabase
      .from('agent_state')
      .upsert({ key, value: value as unknown, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  } catch (err) {
    logError(`[heartbeat] failed to set ${key}`, err)
  }
}

export async function getStateMulti(keys: string[]): Promise<Record<string, unknown>> {
  try {
    const { data } = await supabase
      .from('agent_state')
      .select('key, value')
      .in('key', keys)

    const result: Record<string, unknown> = {}
    for (const row of data || []) {
      result[row.key] = row.value
    }
    return result
  } catch {
    return {}
  }
}

log('[heartbeat] module loaded')
