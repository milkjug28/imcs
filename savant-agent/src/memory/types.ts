export type MemoryType = 'user_fact' | 'conversation' | 'observation' | 'preference'

export interface AgentMemory {
  id: string
  memory_type: MemoryType
  subject: string | null
  content: string
  salience: number
  access_count: number
  created_at: string
  last_accessed: string
  expires_at: string | null
}
