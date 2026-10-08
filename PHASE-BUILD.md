# Cup Night Circuit — Phased Build Plan (v3: NFT + Streaming)

## Phase 1: Core Foundation (target: 2–3 weeks)

### Goal
Port the prototype to a real database-backed site. Organiser-only score entry. Public bracket + circuit table. Basic SSE live update. **Add NFT ticketing, streaming spectator tab, and crypto vault integration.**

---

## Tech Stack & Architecture

| Layer | Technology | Purpose |
|-------|------------|---------|
| Smart Rail | Foundry (Solidity) | `CupNightOracle.sol` — USDC Vault + ERC-721 NFT Ticket Minting |
| AI Oracle | Python (Telethon/Pywhatkit) | Connects WhatsApp/TG to Blockchain. Reads screenshots via Hermes vision, triggers `releaseFunds()` |
| Frontend | Next.js 14+ + Wagmi | Web UI for wallet connect, bracket viewing, streaming embeds |
| Database | Postgres (Supabase/Fly.io) | Tournament metadata, player gamertags, stream URLs (not crypto keys) |

---

## Tasks

### 1.1 Repo & infra scaffolding
- [ ] Create monorepo structure (`apps/web` for Next.js, `apps/api` if separate back-end, `packages/db`, `packages/ui`)
- [ ] Initialize Git with branch strategy (`main`, `develop`, feature branches)
- [ ] DB Migration tool: `prisma` **or** `supabase migrations` (pick one; Prisma preferred for type safety)
- [ ] Setup CI/CD pipeline (GitHub Actions / Fly deploy). Include lint + test on PR.
- [ ] Add environment variable template `.env.example` with all required vars.

### 1.2 DB schema implementation (extended)
- [ ] Create all entities from `SPEC.md` §3 in migration files.
- [ ] Implement constraints (UNIQUE on Player.gamertag, Entry.night_id + status compound)
- [ ] Add indexes per §3 of SPEC.
- [ ] **Extended Schema Fields:**
    - `Entry.twitch_stream_url TEXT` — player's stream link for spectator viewing
    - `TournamentNFT (id PK, tournament_id FK, token_type ENUM[ticket,participant,winner,champion], ipfs_metadata_hash TEXT, minted_at TIMESTAMPTZ)` — dynamic tiered NFT tracking
- [ ] Seed script for one demo circuit (one Night, seeded Matches) to verify the UI works with real data.

### 1.3 Smart Contract: Crypto Vault (`/contracts/CupNightOracle.sol`)
- [ ] **USDC Vault:** Allow players to enter by depositing USDC into a per-night vault contract
- [ ] **NFT Ticket Minting:** On successful entry, mint ERC-721 ticket (ERC-721) tied to that specific night. Different visual tiers based on performance:
    - Entry = "Spectator" tier art (city + date)
    - Match participation = "Competitor" tier unlock
    - Winner = "Cup Night Winner" trophy NFT
    - Circuit champion = unique 1-of-1 gold NFT
- [ ] **Hermes Oracle Interface:** `releaseFunds(uint256)` — only callable by Hermes when score verification passes
- [ ] Deploy to Base Sepolia testnet for initial testing

### 1.4 Organiser-only score entry page (`/admin`)
- [ ] Login route (use whatever auth method chosen — Clerk/Supabase/custom). Gate access to `role == 'organiser'`.
- [ ] Tournament bracket editor: seeded players display in single-elimination tree layout; drag-to-replace or dropdown for seeds.
- [ ] Score entry form per match: enters score_a / score_b, confirms the result (sets `status → reported`).
  - When organiser reports a score for Match A vs B, system sets status to `reported` and updates `score_a`, `score_b`.
  - If organiser changes an existing confirmed result that alters downstream winner, clear all `pending` matches in later rounds. Re-calc bracket path. Log this change in `AuditLog`.
- [ ] Save every admin action to `AuditLog`.

### 1.5 Public bracket view (`/n/:id`)
- [ ] Render single-elimination bracket tree from DB data (matches, entries, players).
- [ ] "Now playing" banner — highlight the match whose round/slot matches the current live event window.
- [ ] Stream URL display (if `stream_url` set by organiser). Link or embed for Twitch/YouTube.
- [ ] Circuit table sidebar (or full tab): points accumulated across all nights; sorted descending.

### 1.6 Home page (`/`)
- [ ] Next kick-off countdown (countdown JS library or custom component targeting `min(Night.starts_at)` for open nights.
- [ ] Current / last night card with quick bracket link.
- [ ] Circuit table (top 10).

### 1.7 Basic SSE live update hook
- [ ] Server route: `/api/events` → SSE endpoint pushing `bracket-update` event.
- [ ] Client component: `EventSource` on Night page subscribes to `/api/events`. On message, updates the local bracket state via React context or store (Zustand/tanstack-query).
- [ ] Reconnect logic (auto-retry with exponential backoff).

### 1.8 Live Streaming / Spectator Mode (`/watch/:tournamentId`) **(NEW)**
- [ ] Load player stream URLs into embedded Twitch/YouTube players — grid layout vs one-on-one for finals
- [ ] Auto-detect when two finalists are live and produce a "VS" merge layout automatically
- [ ] Viewer chat overlay integration (pulls viewers' own Twitch/TG chat into spectator pane)
### 1.9 Social Virality & Recap Bot **(NEW)**
- [ ] Cron job generates recap text after each night: "Tokyo Circuit Final: @KyotoKing defeated @ShibuyaSlayer 4–2 in a dramatic last-minute comeback..."
- [ ] Auto-post to X/Twitter + TG channel with embedded NFT trophy images attached
- [ ] Player-highlight bot: player uploads 30-second clip → automatically adds Cup Night Circuit watermark/overlay via OBS and pushes to a shared highlight reel on YouTube/TikTok

- ✅ Repo with CI/CD pipeline active
- ✅ DB schema deployed on dev / staging
- ✅ Organiser can seed bracket and enter scores at `/admin`
- ✅ Public `/n/:id` shows correct bracket + circuit table
- ✅ Home page with countdown + next night card
- ✅ SSE updates reflect organiser actions in real time
