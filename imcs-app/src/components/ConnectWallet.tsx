'use client'

import { ConnectButton, useAccountModal, useConnectModal, useChainModal } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

type ConnectWalletProps = {
  label?: string
  showBalance?: boolean
  compact?: boolean
  ignoreChain?: boolean
}

export default function ConnectWallet({
  label = 'connect wallut',
  showBalance = false,
  compact = false,
  ignoreChain = false,
}: ConnectWalletProps) {
  const { openAccountModal } = useAccountModal()
  const { openConnectModal } = useConnectModal()
  const { openChainModal } = useChainModal()
  const { address, isConnected, chain } = useAccount()

  if (!isConnected || !address) {
    return (
      <button
        onClick={openConnectModal}
        type="button"
        className="connect-wallet-btn"
        style={{
          fontFamily: 'Comic Neue, cursive',
          fontSize: compact ? '16px' : '20px',
          padding: compact ? '8px 16px' : '12px 24px',
          background: '#ffff00',
          border: '3px solid #000',
          cursor: 'pointer',
          boxShadow: '3px 3px 0 #000',
          transition: 'all 0.1s',
          transform: 'rotate(-1deg)',
        }}
      >
        {label}
      </button>
    )
  }

  const supportedChainIds = [1, 8453]
  if (chain && !supportedChainIds.includes(chain.id) && !ignoreChain) {
    return (
      <button
        onClick={openChainModal}
        type="button"
        style={{
          fontFamily: 'Comic Neue, cursive',
          fontSize: compact ? '16px' : '20px',
          padding: compact ? '8px 16px' : '12px 24px',
          background: '#ff0000',
          border: '3px solid #000',
          cursor: 'pointer',
          boxShadow: '3px 3px 0 #000',
          color: '#fff',
        }}
      >
        wrong network
      </button>
    )
  }

  const displayName = address.slice(0, 6) + '…' + address.slice(-4)

  return (
    <button
      onClick={openAccountModal}
      type="button"
      style={{
        fontFamily: 'Comic Neue, cursive',
        fontSize: compact ? '14px' : '18px',
        padding: compact ? '8px 16px' : '12px 24px',
        background: '#00ff00',
        border: '3px solid #000',
        cursor: 'pointer',
        boxShadow: '3px 3px 0 #000',
        transform: 'rotate(-1deg)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span>{displayName}</span>
    </button>
  )
}
