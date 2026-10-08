import React from 'react'
import { useActiveTournaments } from './hooks/useActiveTournaments'

/* 
 * Embeds player Twitch/YouTube streams in a TV-grid layout.
 * For finals, auto-merges the two finalists into a "VS" split-screen.
 */
export default function StreamWatchTab() {
  const { data: activeTournaments } = useActiveTournaments()

  if (!activeTournaments?.length) {
    return (
      <div className="my-12 bg-gray-800 rounded-lg p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">⚽ Watch Live</h2>
        <p className="text-gray-300">No active streams yet. Join a circuit to watch!</p>
      </div>
    )
  }

  return (
    <div className="my-12 bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-3xl font-bold mb-4">📺 Live Streams</h2>
      
      {activeTournaments.map((tournament) => (
        <div key={tournament.id} className="mb-8 last:mb-0">
          <h3 className="text-xl font-bold mb-4">{tournament.city} Circuit Finals</h3>

          {/* ─── Finals Split-Screen Layout ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournament.finalists?.map((player, idx) => (
              <div key={idx} className="bg-gray-900 rounded overflow-hidden">
                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                  {/* Twitch/YouTube embed based on stream_url type */}
                  {player.streamUrl.includes('twitch') ? (
                    <iframe 
                      src={`https://player.twitch.tv/?channel=${extractChannel(player.streamUrl)}&parent=localhost`}
                      frameBorder="0"
                      allowFullScreen
                      className="absolute top-0 left-0 w-full h-full"
                    />
                  ) : player.streamUrl.includes('youtube') ? (
                    <iframe 
                      src={player.streamUrl.replace('watch?v=', 'embed/')}
                      frameBorder="0"
                      allowFullScreen
                      className="absolute top-0 left-0 w-full h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Stream URL not supported.
                    </div>
                  )}

                  {/* Player info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                    <p className="font-bold text-white">{player.gamertag}</p>
                    <p className="text-xs text-yellow-400">VS</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Viewer Chat Overlay (Twitch/TG) ─ */}
          <div className="mt-4 flex space-x-4">
            <button className="text-sm text-gray-300 hover:text-white">
              💬 Open Twitch Chat
            </button>
            <button className="text-sm text-gray-300 hover:text-white">
              📱 Open Telegram Group
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function extractChannel(url) {
  const match = url.match(/channel=(.+)/)
  return match ? match[1] : ''
}
