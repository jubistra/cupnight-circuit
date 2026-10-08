import React from 'react'
import WagmiProviderWrap from './WagmiWrap'
import Navbar from './components/Navbar'
import TournamentGrid from './components/TournamentGrid'
import CircuitTable from './components/CircuitTable'
import StreamWatchTab from './components/StreamWatchTab'

export default function Home() {
  return (
    <WagmiProviderWrap>
      <main className="min-h-screen bg-gray-900 text-white">
        {/* ─── Navbar / Header ───────────────────── */}
        <Navbar />
        
        {/* ─── Hero Section ──────────────────────── */}
        <section className="py-16 px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">⚽ Cup Night Circuit</h1>
          <p className="text-xl text-gray-300 mb-8">
            Autonomous FIFA tournaments. Entry in USDC. 
            Verified by AI Oracle. Payouts on-chain.
          </p>

          {/* Next Kickoff Countdown */}
          <div className="bg-gray-800 inline-block rounded-lg p-6">
            <h2 className="text-2xl mb-2">Next Global Circuit: Tokyo</h2>
            <CountdownTarget date={getNextFri()} />
          </div>
        </section>

        {/* ─── Active / Open Tournaments ─────────── */}
        <section className="px-4 max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">Join a Circuit</h2>
          <TournamentGrid />

          {/* ─── Spectator Mode (Live Streams) ────── */}
          <StreamWatchTab />
        </section>

        {/* ─── Global Circuit Table ──────────────── */}
        <section className="px-4 max-w-6xl mx-auto my-16">
          <h2 className="text-3xl font-bold mb-6">🏆 World Circuit Leaderboard</h2>
          <CircuitTable limit={50} />
        </section>

        <footer className="text-center py-8 text-gray-500">
          CupNight Oracle verified • USDC vaults on Base Sepolia • AI Judge powered by Hermes
        </footer>
      </main>
    </WagmiProviderWrap>
  )
}

// ─── Countdown Timer Component ────────────────
function getNextFri() {
  const now = new Date()
  const daysToNextFri = (5 - now.getDay() + 7) % 7 || 7 // Always next Fri if it's past
  const nextDate = new Date(now)
  nextDate.setDate(now.getDate() + daysToNextFri)
  nextDate.setHours(20, 0, 0, 0) // 8PM local (would use user TZ in prod)
  return nextDate
}

function CountdownTarget({ date }) {
  const [timeLeft, setTimeLeft] = React.useState(calculateLeft(date))
  
  function calculateLeft(target) {
    const diff = target - new Date()
    if (diff <= 0) return 'Kickoff!'
    
    return (
      <>
        <span>{Math.floor(diff / (1000 * 60 * 60 * 24))}d </span>
        <span>{Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}h </span>
        <span>{Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m </span>
        <span>to kickoff</span>
      </>
    )
  }

  React.useEffect(() => {
    const id = setInterval(() => setTimeLeft(calculateLeft(date)), 1000)
    return () => clearInterval(id)
  }, [date])

  return <p className="text-2xl font-mono">{timeLeft}</p>
}
