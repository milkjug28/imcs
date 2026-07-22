'use client'

import { ReactNode } from 'react'
import { WalletProvider } from '@/components/WalletProvider'
import { HolderProvider } from '@/hooks/useHolderData'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <HolderProvider>
        {children}
      </HolderProvider>
    </WalletProvider>
  )
}
