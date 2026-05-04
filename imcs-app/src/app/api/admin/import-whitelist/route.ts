import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Admin route to import a list of wallet addresses directly into the whitelist
 *
 * Usage:
 * 1. POST an array of strings (wallet addresses) to this endpoint
 * 2. It will validate and upsert them into the whitelist table, ignoring duplicates
 *
 * POST /api/admin/import-whitelist
 * Body: {
 *   wallets: ["0x...", "0x...", ...]
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallets } = body

    if (!wallets || !Array.isArray(wallets)) {
      return NextResponse.json(
        { error: 'Invalid format. Expected an array of wallet addresses.' },
        { status: 400 }
      )
    }

    const report = {
      total: wallets.length,
      added: 0,
      skipped: 0,
      invalid: 0,
      details: [] as any[]
    }

    const walletRegex = /^0x[a-fA-F0-9]{40}$/
    const validWallets: any[] = []

    for (const rawAddress of wallets) {
      if (!rawAddress || typeof rawAddress !== 'string') {
        report.invalid++
        continue
      }

      const wallet = rawAddress.trim().toLowerCase()

      if (!walletRegex.test(wallet)) {
        report.invalid++
        report.details.push({ wallet, status: 'invalid', reason: 'Invalid wallet address format' })
        continue
      }

      validWallets.push({
        wallet_address: wallet,
        status: 'approved',
        method: 'manual',
        updated_at: new Date().toISOString()
      })
    }

    if (validWallets.length > 0) {
      // Use upsert with onConflict to handle duplicates
      // Supabase's JS client doesn't directly support 'ignoreDuplicates: true' but we can use 'onConflict'
      // to do nothing if it already exists or just update the timestamp/method.
      const { data, error } = await supabase
        .from('whitelist')
        .upsert(validWallets, { 
          onConflict: 'wallet_address',
          ignoreDuplicates: false // We'll update them to ensure they are 'approved' and 'manual'
        })
        .select()

      if (error) {
        console.error('Supabase upsert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      report.added = data?.length || 0
      report.skipped = validWallets.length - report.added
    }

    return NextResponse.json({
      success: true,
      message: `Import complete! Added/Updated ${report.added}, Invalid ${report.invalid}`,
      report
    })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Import failed: ' + error.message },
      { status: 500 }
    )
  }
}
