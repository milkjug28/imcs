'use client'

import { useAccount, useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'

export function useWallet() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  const connect = () => {
    if (openConnectModal) {
      openConnectModal()
    }
  }

  return {
    address,
    truncatedAddress,
    isConnected: isConnected || !!address,
    isConnecting,
    isReconnecting,
    connect,
    disconnect,
  }
}
