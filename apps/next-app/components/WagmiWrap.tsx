'use client'
import { configureChains, createConfig, WagmiProvider } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { MetaMaskConnector } from 'wagmi/connectors/metamask'

// Configure wallet connection — Base Sepolia testnet for Cup Night
const { publicClient, webSocketPublicClient } = configureChains(
  [baseSepolia],
  [publicProvider()]
)

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [new MetaMaskConnector()],
  publicClient,
  webSocketPublicClient,
})

export default function WagmiProviderWrap({ children }) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
}
