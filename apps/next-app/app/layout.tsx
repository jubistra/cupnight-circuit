import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '⚽ CupNight Circuit — Autonomous FIFA Tournaments',
  description: 'Borderless crypto vault tournaments. Entry in USDC. AI Oracle verification. Live streaming spectator mode.',
  keywords: ['FIFA tournaments', 'crypto esports', 'USDC entry', 'NFT tickets', 'AI judge', 'autonomous circuits'],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
