// CupNightOracle.sol — Contract interface for wagmi/ethers hooks
export const CUPNIGHT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CUPNIGHT_CONTRACT_ADDRESS || '0x...'

export const abi = [
  // ─── CreateTournament (admin only) ──────────────
  {
    "inputs": [
      { "name": "_city", "type": "string" },
      { "name": "_startBlock", "type": "uint64" },
      { "name": "_endBlock", "type": "uint64" },
      { "name": "_maxPlayers", "type": "uint8" }
    ],
    "name": "createTournament",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  // ─── joinTournament (player entry) ──────────────
  {
    "inputs": [
      { "name": "_tournamentId", "type": "uint256" },
      { "name": "_entryAmount", "type": "uint256" }
    ],
    "name": "joinTournament",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  // ─── Tournament state (read-only view) ──────────
  {
    "inputs": [{ "name": "", "type": "uint256" }],
    "name": "tournaments",
    "outputs": [
      { "name": "id", "type": "uint256" },
      { "name": "city", "type": "string" },
      { "name": "startBlock", "type": "uint64" },
      { "name": "endBlock", "type": "uint64" },
      { "name": "winner", "type": "address" },
      { "name": "isSettled", "type": "bool" },
      { "name": "cancelled", "type": "bool" },
      { "name": "totalPool", "type": "uint256" },
      { "name": "maxPlayers", "type": "uint32" },
      { "name": "currentPlayers", "type": "uint32" }
    ],
    "stateMutability": "view",
    "type": "function"
  },

  // ─── active_tournaments (get all current IDs) ──
  {
    "inputs": [],
    "name": "getActiveTournaments",
    "outputs": [{ "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },

  // ─── Event emissions (frontend listeners) ──────
  {
    "anonymous": false,
    "inputs": [
      { "name": "id", "type": "uint256", "indexed": true },
      { "name": "city", "type": "string" }
    ],
    "name": "TournamentCreated",
    "type": "event"
  },

  {
    "anonymous": false,
    "inputs": [
      { "name": "tournamentId", "type": "uint256", "indexed": true },
      { "name": "player", "type": "address", "indexed": false }
    ],
    "name": "EntryDeposited",
    "type": "event"
  },

  {
    "anonymous": false,
    "inputs": [
      { "name": "tournamentId", "type": "uint256", "indexed": true },
      { "name": "winner", "type": "address", "indexed": false }
    ],
    "name": "WinnerConfirmed",
    "type": "event"
  },

  {
    "anonymous": false,
    "inputs": [
      { "name": "tournamentId", "type": "uint256", "indexed": true },
      { "name": "minter", "type": "address", "indexed": true },
      { "name": "tier", "type": "uint8" }
    ],
    "name": "NFTMinted",
    "type": "event"
  }
]
