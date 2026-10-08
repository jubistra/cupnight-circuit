# Cup Night Circuit — Web3 Architecture (Crypto Rail)

**Core Principle:** Fully autonomous, borderless tournament operations. Zero fiat gatekeepers, zero KYC requirements. Every entry and payout is a direct wallet-to-wallet or smart contract transaction. Operates locally in the player's timezone every Fri/Sat/Sun at 8 PM local time.

---

## 1. Why Crypto Rail?
- **Bypasses Banking Restrictions:** No need for Irish Business PayPal, UAE DET permits, or cross-border wires. 
- **Global Scope Naturally Supported:** Any wallet holder worldwide can connect and play instantly without regional account restrictions (PayPal Ireland blocks are avoided entirely).
- **Instant Payouts:** Prizes leave the vault in seconds—no manual processing by the organiser once a winner is confirmed.

---

## 2. The Tech Stack & Tools
| Component | Tool/Standard | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js + Wagmi + RainbowKit/Viem | Wallet connection (MetaMask, Coinbase Wallet). Auto-detects user timezone for "Next Night" countdown. |
| **Smart Contract** | Solidity (EVM-compatible) | Escrows entry fees, defines the prize pool, and automates payouts to winners. Runs on a low-fee L2 (e.g., Polygon, Arbitrum, or Base). |
| **Identity** | Wallet Address (`0x...`) | Acts as the player's "gamertag." The contract maps `0xAddress` -> `Gamertag`. |
| **Proof Storage** | IPFS / Arweave (or Cloudflare R2) | Players upload screenshot proofs of victory directly to the decentralized web or a cheap object store. |

---

## 3. Contract Architecture (`CupNightTournament.sol`)

### Lifecycle Logic:
1. **`createTournament(address vault, uint entryFee, string tournamentHash)`**:
   - Creates a new "Night" (e.g., `tournamentId = 20260405_Dubai_Night1`).
   - Sets the `entryFee` (in USDC/DAI/WETH) and defines the deadline.
   - **Hermes Automation:** An on-chain scheduler (Chainlink Keepers) or off-chain bot triggers this automatically whenever it's Friday/Saturday/Sunday 8 PM in a "Circuit City."

2. **`joinTournament(uint tournamentId)`**:
   - The player connects their wallet and mints a "Ticket" by sending the `entryFee` to the contract vault.
   - Slot is reserved. If full, they are automatically moved to an on-chain `waitlist` mapping.

3. **`submitProof(uint tournamentId, uint matchIdx, bytes32 proofHash)`**:
   - Both players submit their scores/proofs. The contract tracks which players have submitted.
   - *Note:* Since FIFA doesn't provide a public API for score verification, Hermes (as the trusted admin/oracle) reviews proofs off-chain and then calls:

4. **`confirmWinner(uint tournamentId)`**:
   - After scoring is verified, the organiser/Hermes sets the winner's wallet address in the contract state.
   - The vault automatically routes 90% of the pooled `entryFee` to the winner's wallet (minus the house fee) via a single atomic transaction.

---

## 4. Automated Circuit Flow (Autonomous Worldwide Mode)
Instead of manually creating tournaments for "Dubai" or "Ajman," the system becomes location-agnostic:

1. **Time-based Activation:** The moment it hits Fri/Sat/Sun 8 PM anywhere major, Hermes activates a new circuit ID using local block time + timezone oracles (Chainlink).
2. **Global Open Enrollment:** Players in Tokyo connect first; players in Berlin connect an hour later as the tournament rolls across continents. 
3. **On-Chain Standings:** Points are tracked on-chain via `CupNightCircuitStanding.sol`. The "Circuit Table" at the top of the website pulls directly from the blockchain to show global rankings.

**Example Player Experience (Fully Local Time):**
> *User in London logs in.* -> Sees "Next Night: 8 PM BST (London Circuit)" + an **Enter with Wallet** button.
> *User connects wallet* -> Transacts 0.05 USDC via their existing DApp browser in mobile or desktop.
> *Result matches final on-screen time:* The contract is now active and accepting global entries.

---

## 5. Financial & Compliance Stance (The "No Rules" Philosophy)
- **Decentralized Liability:** By using a smart contract, the system acts strictly as code rather than a financial institution. 
- **No Fiat Exit Required:** Winners receive their exact entry pool in crypto. They can trade or hold via their own bridge/exchange without needing to cash out through a bank and face audits.
- **Tolerance for Open Entry:** No need to block specific countries (as PayPal would do). If someone in [Restricted Region] wants to play because the network allows it, they play.

---

## 6. Updated Project Directory Structure
```text
projects/
└── CupNightCircuit/
    ├── SPEC.md             (Original: rules, scoring, tournament logic)
    ├── PHASE-BUILD.md      (Build steps for core app functionality)
    └── crypto-architecture.md (Current file: Web3 stack, contract architecture)
```

---

## Actionable Next Steps for Building this Rail
1. Select a low-cost EVM chain (Polygon or Base are best for micro-transactions). 
2. Draft the initial `CupNightTournament.sol` in Remix IDE or Foundry to test the entry escrow and payout logic.
3. Update the frontend `Wagmi` provider to pull circuit status based on the current time relative to a player's local timezone.
