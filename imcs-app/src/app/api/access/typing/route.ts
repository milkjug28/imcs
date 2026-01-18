import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ip, success, wpm } = body

    if (!ip) {
      return NextResponse.json(
        { error: 'IP required' },
        { status: 400 }
      )
    }

    // Record attempt
    await supabase
      .from('access_attempts')
      .insert({
        ip_address: ip,
        attempt_type: 'typing',
        success,
        score: wpm,
      })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Typing attempt error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
