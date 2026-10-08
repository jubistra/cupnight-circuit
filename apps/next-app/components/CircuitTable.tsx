import React from 'react'

/* 
 * Fetches player leaderboard from Supabase DB + contract state.
 * Shows points across all nights they've participated.
 */
export default function CircuitTable({ limit = 50 }) {
  // In real impl: fetch from Supabase REST endpoint /api/circuit/leaderboard
  const [players, setPlayers] = React.useState([])
  
  React.useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch(`/api/circuit/leaderboard?limit=${limit}`)
        const data = await res.json()
        setPlayers(data.players)
      } catch (e) {
        console.error('Failed to load circuit table:', e)
      }
    }
    fetchLeaderboard()
  }, [limit])

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-900 divide-x divide-gray-600">
            <th className="px-4 py-3 text-left font-medium text-gray-400">#</th>
            <th className="px-4 py-3 text-left font-medium text-gray-400">Player</th>
            <th className="px-4 py-3 text-left font-medium text-gray-400">Tournaments</th>
            <th className="px-4 py-3 text-left font-medium text-gray-400">Wins</th>
            <th className="px-4 py-3 text-left font-medium text-gray-400">Points</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, idx) => (
            <tr key={player.wallet} className="border-b border-gray-700 hover:bg-gray-750">
              <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center space-x-2">
                  {/* NFT avatar or default avatar */}
                  {player.lastNFT?.ipfsHash ? (
                    <img 
                      src={`https://ipfs.io/ipfs/${player.lastNFT.ipfsHash}`} 
                      alt="NFT Trophy" 
                      className="w-6 h-6 rounded-full" 
                    />
                  ) : null}
                  <span className="font-medium text-white truncate max-w-[120px]">
                    {player.gamertag || 'Unknown'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-300">{player.tournamentCount}</td>
              <td className="px-4 py-3 text-green-400">{player.winCount}</td>
              <td className="px-4 py-3 font-bold text-yellow-400">{player.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
