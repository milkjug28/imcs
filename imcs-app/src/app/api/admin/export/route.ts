import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'all' // 'all' or 'whitelisted'

    let query = supabase
      .from('leaderboard_scores')
      .select('wallet_address, name, info, total_points, created_at, whitelist_status')
      .order('total_points', { ascending: false })

    if (type === 'whitelisted') {
      query = query.eq('whitelist_status', 'approved')
    }

    const { data, error } = await query

    if (error) {
      console.error('Export fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return new NextResponse('wallet_address,name,score,whitelist_status\n', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="export_${type}.csv"`
        }
      })
    }

    // Generate CSV
    const headers = ['wallet_address', 'name', 'score', 'whitelist_status', 'created_at']
    const csvRows = [headers.join(',')]

    for (const row of data) {
      const values = [
        row.wallet_address,
        `"${(row.name || '').replace(/"/g, '""')}"`,
        row.total_points || 0,
        row.whitelist_status || 'pending',
        row.created_at
      ]
      csvRows.push(values.join(','))
    }

    const csvString = csvRows.join('\n')

    return new NextResponse(csvString, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="export_${type}_${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
