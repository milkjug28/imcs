'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'

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
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading'
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated')

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
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

              if (chain.unsupported && !ignoreChain) {
                return (
                  <button
                    onClick={() => openChainModal()}
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
                  {showBalance && account.displayBalance && (
                    <span>{account.displayBalance}</span>
                  )}
                  <span>{account.displayName}</span>
                </button>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
