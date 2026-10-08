import React from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function Navbar() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  return (
    <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
      {/* ─── Logo / Branding ───────────── */}
      <a href="/" className="text-xl font-bold tracking-tight">
        ⚽ <span className="text-yellow-400">CupNight</span> Circuit
      </a>

      <div className="flex items-center space-x-6">
        <a href="/circuit" className="hover:text-yellow-400 text-sm">
          Circuit Table
        </a>
        <a href="/watch" className="hover:text-yellow-400 text-sm">
          Watch Live
        </a>

        {/* ─── Wallet Connect Button ───── */}
        {isConnected && address ? (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-300 truncate max-w-[120px]">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <button onClick={() => disconnect()} className="text-red-400 text-sm">
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect({ connector: new (require('wagmi').MetaMaskConnector)() })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  )
}
