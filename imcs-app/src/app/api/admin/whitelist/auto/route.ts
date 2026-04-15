import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Auth check - in a real app this would use a session/cookie
    // For now, we trust the admin page password flow
    
    const { data, error } = await supabase.rpc('update_whitelist_auto')

    if (error) {
      console.error('Auto-whitelist error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // data is returned as an array since the function returns a TABLE
    const updatedCount = Array.isArray(data) ? data[0]?.updated_count : 0

    return NextResponse.json({ 
      success: true, 
      updated_count: updatedCount || 0 
    })
  } catch (error: any) {
    console.error('Auto-whitelist route error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
