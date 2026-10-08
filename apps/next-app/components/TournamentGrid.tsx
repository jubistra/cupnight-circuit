import React from 'react'
import { useAccount } from 'wagmi'
import { useActiveTournaments } from './hooks/useActiveTournaments'

/* 
 * Displays all open tournaments with city, entry fee, and join button.
 * Data fetches from contract via Wagmi hooks (useActiveTournaments).
 */
export default function TournamentGrid() {
  const { address } = useAccount()
  const { data: tournaments, isLoading, error } = useActiveTournaments()

  if (isLoading) return <p className="text-gray-400">Loading circuits...</p>
  if (error) return <p className="text-red-400">Failed to load tournaments</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {tournaments?.map((t) => (
        <TournamentCard key={t.id} tournament={t} address={address} />
      ))}
    </div>
  )
}

function TournamentCard({ tournament, address }) {
  const [joined, setJoined] = React.useState(false)
  const { joinTournament } = useJoinTournament()

  async function handleJoin() {
    await joinTournament(tournament.id, tournament.entryAmount)
    setJoined(true)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-yellow-400 transition">
      <h3 className="text-xl font-bold mb-2">{tournament.city}</h3>
      <p className="text-sm text-gray-400 mb-4">
        Start: Friday 8PM • {tournament.maxPlayers} slots
      </p>
      
      {/* ─── NFT Ticket Display ──────────── */}
      {!joined ? (
        <button
          onClick={handleJoin}
          disabled={!address}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg"
        >
          {address ? 'Join Circuit' : 'Connect Wallet to Join'}
        </button>
      ) : (
        <div className="text-green-400 font-medium">✅ Joined — NFT Ticket Minted</div>
      )}

      {/* ─── Stream Link Input (for finals) ─ */}
      {joined && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <label className="text-sm text-gray-300 block mb-2">
            📺 Paste Twitch/YouTube stream link:
          </label>
          <input
            type="text"
            placeholder="https://twitch.tv/your-channel"
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  )
}

/* Custom hook to fetch active tournaments from CupNightOracle.sol */
import { useState, useEffect } from 'react'
import { useWriteContract, useReadContract } from 'wagmi'
import { CUPNIGHT_CONTRACT_ADDRESS, abi } from '@/constants/contractConstants'

export function useActiveTournaments() {
  const { data: tournamentIds, isLoading, error } = useReadContract({
    address: CUPNIGHT_CONTRACT_ADDRESS,
    abi,
    functionName: 'getActiveTournaments',
  })

  // Fetch full tournament details for each active ID
  const [tournaments, setTournaments] = useState([])
  
  useEffect(() => {
    if (!tournamentIds?.length) return
    const fetchDetails = async () => {
      const details = []
      for (const id of tournamentIds) {
        // In real impl: use wagmi multi-read or fallback to RPC calls
        details.push({ id, city: 'Tokyo', ... })  // ← fill from contract state mapping
      }
      setTournals(details)
    }
    fetchDetails()
  }, [tournamentIds])

  return { data: tournaments, isLoading, error }
}

/* Hook for joining via wallet */
export function useJoinTournament() {
  const { writeContract } = useWriteContract();

  async function joinTournament(tournamentId, entryAmount) {
    // First approve USDC transfer, then call contract.joinTournament
    return writeContract({
      address: CUPNIGHT_CONTRACT_ADDRESS,
      abi,
      functionName: 'joinTournament',
      args: [tournamentId, entryAmount],
    })
  }

  return { joinTournament }
}
