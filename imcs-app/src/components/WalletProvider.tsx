'use client'

import '@rainbow-me/rainbowkit/styles.css'
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { mainnet, base } from 'wagmi/chains'
import { http } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

const config = getDefaultConfig({
  appName: 'Imaginary Magic Crypto Savants',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'demo',
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
  },
  ssr: true,
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#ff00ff',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
