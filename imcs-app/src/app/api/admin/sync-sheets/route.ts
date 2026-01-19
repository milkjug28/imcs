import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Admin route to sync Google Sheets data to Supabase
 *
 * Usage:
 * 1. Export Google Sheet as JSON (or use the doGet endpoint)
 * 2. POST to this endpoint with the data
 * 3. Returns report of what was synced
 *
 * POST /api/admin/sync-sheets
 * Body: {
 *   data: [
 *     { name: "Alice", info: "my submission", wallet_address: "0x...", timestamp: "..." },
 *     ...
 *   ]
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data, secretKey } = body

    // Simple auth check (you can change this)
    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected array of submissions.' },
        { status: 400 }
      )
    }

    const report = {
      total: data.length,
      added: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as any[]
    }

    // Get all existing wallet addresses from Supabase
    const { data: existingSubmissions } = await supabase
      .from('submissions')
      .select('wallet_address')

    const existingWallets = new Set(
      existingSubmissions?.map(s => s.wallet_address.toLowerCase()) || []
    )

    // Process each submission
    for (const row of data) {
      const { name, info, wallet_address, ip, timestamp } = row

      // Skip if missing required fields
      if (!wallet_address || !name || !info) {
        report.skipped++
        report.details.push({
          wallet: wallet_address || 'unknown',
          status: 'skipped',
          reason: 'Missing required fields'
        })
        continue
      }

      const walletLower = wallet_address.trim().toLowerCase()

      // Skip if already in Supabase
      if (existingWallets.has(walletLower)) {
        report.skipped++
        report.details.push({
          wallet: walletLower,
          status: 'skipped',
          reason: 'Already exists in Supabase'
        })
        continue
      }

      // Validate wallet address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
        report.skipped++
        report.details.push({
          wallet: wallet_address,
          status: 'skipped',
          reason: 'Invalid wallet address format'
        })
        continue
      }

      // Generate referral code
      const referralCode = generateReferralCode(walletLower)

      // Insert into Supabase
      const { error } = await supabase
        .from('submissions')
        .insert({
          wallet_address: walletLower,
          name: name.trim(),
          info: info.trim(),
          ip_address: ip || null,
          referrer_code: referralCode,
          created_at: timestamp || new Date().toISOString()
        })

      if (error) {
        report.errors.push(`${walletLower}: ${error.message}`)
        report.details.push({
          wallet: walletLower,
          status: 'error',
          reason: error.message
        })
      } else {
        report.added++
        existingWallets.add(walletLower) // Add to set to avoid duplicates in same import
        report.details.push({
          wallet: walletLower,
          status: 'added',
          name: name.trim()
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync complete! Added ${report.added}, skipped ${report.skipped}, errors ${report.errors.length}`,
      report
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check current sync status
 * Compares Google Sheets data with Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const secretKey = searchParams.get('secretKey')

    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get Supabase count
    const { count: supabaseCount } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      supabase_submissions: supabaseCount || 0,
      message: 'Use POST endpoint with Google Sheets data to sync'
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Status check failed' },
      { status: 500 }
    )
  }
}

// Helper function to generate referral code
function generateReferralCode(walletAddress: string): string {
  const walletPart = walletAddress.slice(-6)
  const randomPart = Math.random().toString(36).substring(2, 6)
  return `${walletPart}${randomPart}`.toUpperCase()
}
