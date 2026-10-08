# Cup Night Circuit — full build spec (v1)

A touring FC 27 weekend circuit: one city per night (Fri / Sat / Sun), eight players each, single-elimination with live bracket. A circuit table aggregates points across all three nights.

**What exists now:** static prototype (`index.html` published as artifact). Hermes builds the real site + backend around it.

---

## 1. Hard constraints (unchanged)

- **No EA server integration.** All results come from players / organiser.
- **EA community tournament guidelines** apply: max US$20 entry fee, prize pool before start, only Ultimate Team or Kick Off, no EA trademark/artwork, sponsors referenced but not in tournament title. Re-check FC 27-specific wording before launch.
- **UAE rules.** Random prize draw with paid entry needs a DET permit in Dubai; other emirates differ. Default: skill-based prizes only (safer). Free-entry draw is Phase 1+ later only after permit confirmed. Under-18: guardian consent required, no real-money prizes to minors without legal advice.
- **Entry fee** funds prize pool + costs capped at US$20 total.

---

## 2. Roles & permissions

| Role | Capabilities | Auth |
|------|-------------|------|
| Spectator | View bracket, circuit table, stream link, recaps, rules, player profiles. | None (public). |
| Player | Register to a night (when open), pay entry fee, report scores with proof screenshots, view own results & history, sign up for SMS/email reminders. | Email/phone login or OAuth (Google / Apple preferred). |
| Organiser | Create circuits/nights, seed brackets, confirm scores, resolve disputes, publish prizes, set stream links, send reminders, publish social posts, manage waitlist, manage sponsors/slots. | Auth + role check (`role == 'organiser'`) — invitation-only account. |

---

## 3. Data model (expanded)

### Entities

```
Circuit          (id PK, name TEXT, season INTEGER, status ENUM[planning,open,closed,finished], created_at, updated_at)
Night            (id PK, circuit_id FK, city TEXT, venue TEXT, starts_at TIMESTAMPTZ, capacity SMALLINT DEFAULT 8,
                  mode ENUM[kick_off,ultimate_team], entry_fee DECIMAL(6,2), prize_pool DECIMAL(10,2),
                  status ENUM[planning,open,started,completed], stream_url TEXT,
                  rules_override JSONB, created_at, updated_at)
Player           (id PK, gamertag TEXT UNIQUE, platform ENUM[psn,xbox,steam,pc], contact TEXT, consent_at TIMESTAMPTZ,
                  is_minor BOOLEAN DEFAULT false, guardian_name TEXT, guardian_contact TEXT,
                  created_at, updated_at)
Entry            (id PK, night_id FK, player_id FK, seed SMALLINT, paid BOOLEAN DEFAULT false, paid_at TIMESTAMPTZ,
                  stripe_payment_id TEXT, status ENUM[confirmed,dropped,on_waitlist])
Match            (id PK, night_id FK, circuit_id FK, round ENUM[qf,sf,f], slot INTEGER, a_entry_id FK, b_entry_id FK,
                  score_a SMALLINT, score_b SMALLINT, pens_winner ENUM[a,b,null], status ENUM[pending,reported,confirmed,disputed],
                  confirmed_by TEXT (organiser id or system), created_at, updated_at)
Report           (id PK, match_id FK, reported_by_entry_id FK, score_a SMALLINT, score_b SMALLINT,
                  pens_winner ENUM[a,b,null], proof_url TEXT, status ENUM[submitted], created_at)
Standing         (derived — see scoring rules; pre-calculated per night / circuit and cached in the DB).
AuditLog         (id PK, entity_type TEXT, entity_id INTEGER, action TEXT, actor_id FK, old_vals JSONB, new_vals JSONB,
                  at TIMESTAMPTZ)
Reminders        (player_entry_fk, event ENUM[confirmed,dropped,on_waitlist], sent_at TIMESTAMPTZ).
Organiser        (id PK, player_id FK UNIQUE /* maps to a Player account */, role TEXT DEFAULT 'organiser',
                  created_at, updated_at)
```

### Indexes (minimum viable)

- `Player(gamertag)` UNIQUE
- `Entry(night_id, status)` — fast look-up of open/dropped/waitlist entries
- `Match(night_id, round, slot)` UNIQUE — prevents duplicate bracket slots
- `Report(match_id)` UNIQUE — one report per match (players merge before save)
- `Standing(competition_id, circuit_name)` for leaderboard cache

### Scoring model

| Placement | Points |
|-----------|--------|
| Winner    | 10     |
| Runner-up | 6      |
| Semi loser| 3      |
| Quarter loser| 1   |

Standings computed as `SUM(points)` per night and per circuit; cached table updated on confirmed result.

### Status transitions (key)

**Entry:** `open → paid → confirmed` / `confirmed → dropped → on_waitlist` / `on_waitlist → confirmed`
**Match:** `pending → reported → confirmed` / `pending → disputed` / `disputed → verified`
**Night:** `planning → open → started → completed`

---

## 4. Pages & routes

| Route | Template | Auth | Notes |
|-------|----------|------|-------|
| `/` | Home | Public | Countdown, next/last night card, circuit table (top 10), stream link if live |
| `/n/:id` | Night page | Public | Bracket tree, "now playing" banner, stream embed/link, recap section |
| `/join` | Register / Login form | Optional → required on submit | Select night, enter gamertag + platform, agree rules & consent checkbox, Stripe payment |
| `/p/:tag` | Player profile | Public | Gamertag avatar, night history, points breakdown, H2H table vs opponents |
| `/admin` | Organiser console | **Organiser only** | Seeding UI, score entry + dispute queue, player management (confirm / drop), publishing prizes, social draft |
| `/rules` | Rules & prizes | Public | Full rules, permits status, entry fee breakdown |
| `/overlay/:night_id` | OBS overlay page | **None** (or optional API key) | Browser overlay URL for OBS — large fonts, translucent background, "now playing" + bracket snapshot. Auto-refreshes via SSE. |

---

## 5. Live matching / score workflow

```
     ╔═══ Player A              ═══╦═══ Player B              ═══╗
     ║   Enters score: 3–2        ║    Enters score: 3–1       ║
     ╚══════════════╤══════════════╩════════════════════════════╝
                    │ MATCHED ✓ (both same result) → auto-confirm winner
                    │ MISMATCH → disputed, both screenshotted proofs queued for organiser queue
```

- **Matched path:** when *both* reporters confirm identical scores, system auto-confirms winner and propagates bracket forward.
- **Dispute path:** mismatch triggers `disputed` status; organiser reviews proof images + recommended ruling from Hermes automation; manual override allowed.
- **Penalty shootouts:** if `score_a == score_b`, both reporters enter separate penalty winners. System checks: match → auto-confirm, mismatch → dispute (flag for organiser to check match footage).
- **Confirmed result that changes downstream winner (the prototype already handles this):** the system clears `pending` matches in later rounds and recalculates bracket path on reconfirm.

---

## 6. Hermes automation (what the agent does)

| Event | Trigger | Automation | Delivery channel |
|-------|---------|------------|-----------------|
| Registration confirmed | Player pays | SMS / Email: welcome + rules link + check-in reminder at 7:30 PM night-of | Twilio + Resend (or Mailgun) |
| 24h countdown | Schedule cron | SMS/Email: "Tomorrow's cup! Check-in at 7:30 pm, kick-off 8 pm." | — |
| Drop detected | Entry status → `dropped` | Promote first player on the waitlist via SMS/email. Notify original if slot fills back. | — |
| Round complete (first to report) | Match confirmed | Recaps text auto-generated for each round; result card copy in markdown + social draft Twitter/X post. Organiser reviews before publish. | Slack (organiser channel), SMS |

**Rules of automation:**

- Hermes **never changes a result** — it only flags disputes and *recommends*.
- Always log every automated action in `AuditLog`.
- Reminders use the player's preferred channel (`SMS` or `email`) stored on `Player.contact`.

---

## 7. Architecture

```
                              ┌─────────────┐
                              │   Browser    │
                              │  (Spectator) │
                              └──────┬───────┘
                                     │ https://cupsnight.com
                     ┌─────────────────┼─────────────────┐
                     │                │                   │
              ┌─────▼──────┐   ┌─────▼─────┐     ┌─────▼───────┐
              │  Next.js    │   │  Organiser│     │  OBS Overlay│
              │  (static    │   │  Console  │     │  /overlay/:nid│
              │   pages)    │   │ (SSR/SPA) │     └─────────────┘
              └──────┬──────┘   └─────┬─────┘
                     │                │
               ┌─────▼────────────────▼─────┐
               │                           API  │        SSE push for live updates
               │    (Hermes → Node / Python)  │◄────► Player dashboard → bracket
               │   Express + Postgres         │
               └──────┬──────────────────────┘
                      │
            ┌─────────▼──────────┐
            │     Postgres DB     │
            │   (self-hosted or   │
            │    cloud 17/34x)   │
            └────────────────────┘

         ┌──────────┐    ┌───────────┐    ┌────────────┐
         │Stripe API│    │  Twilio /  │    │Resend /   │
         │Payments  │    │ Email     │    │Mailgun SMS │
         └──────────┘    └───────────┘    └────────────┘

         ┌──────────────┐        ┌─────────────────────┐
         │ File storage │◄──────▶│ Object store (R2/   │
         │ Screenshots  │        │ S3-compatible)       │
         └──────────────┘        └─────────────────────┘
```

### Key tech choices

| Layer | Choice | Why |
|-------|--------|-----|
| Hosting (app) | Fly.io **OR** Render (cheap for MVP). UAE region optional later. | Low monthly cost, easy Postgres integration, scales with circuit events. |
| Front-end framework | Next.js 14+ App Router | Strong SSR support for live updates; built-in Image API for player avatars/screenshots. |
| Back end | Node.js (Express) **OR** Python (FastAPI). Both good. | Hermes prefers either — pick based on your dev comfort. Next.js Route Handlers could also serve the API from the same repo (simpler monorepo). |
| DB | PostgreSQL 16+ | Relational data, JSONB for flexible fields (e.g., `rules_override`), good for tournament logic. |
| Auth | Clerk **OR** Supabase Auth **OR** custom JWT + Magic Link | Depends on comfort with third-party vs building own auth. Clerk/Supabase fastest initial setup. |
| Payments | Stripe Checkout (hosted flow). UAE bank accounts? Check if Stripe Arabia supported; if not, consider **Telr** or **PayTabs** (local gateways with Stripe-style API). | Hosted checkout = less PCI burden. Local gateway needed for UAE card acceptance at low cross-border fees. |
| Photo storage | Cloudflare R2 | Cheap egress (zero egress to CF edge), works well with next/image optimization pipeline. |
| Reminders / SMS | Twilio **OR** messagebird or airtel SMS gateway (UAE compliance) | Depends on target audience; UAE local SMS may be cheaper than direct carrier via Twilio. |
| Email delivery | Resend (cheap, great for transactional + marketing). | Easy API, good template support. |
| OBS overlay browser extension | Not needed — streamers add the page as a "browser source" in OBS directly. | Pure HTML / CSS with transparent background. |

### SSE architecture (live updates)

- **Server sends:** `event: bracket-update` → JSON payload {match_id, status, score_a, score_b, winner_entry_id}.
- **Clients subscribe** on page load; reconnects handled automatically by browser `EventSource`.
- No external WebSocket server needed — all SSE goes through the Express/Node route and is proxied via Next API.

---

## 8. Phased build order (expanded)

See `PHASE-BUILD.md` for detailed step-by-step implementation tasks per phase.

**1. Phase 1: Core foundation (2–3 weeks)**
   - Setup repo, DB schema, CI/CD pipeline, dev environment.
   - Organiser-only score entry page (port prototype style).
   - Public bracket view, circuit table, night pages.
   - Basic SSE live-update hook.

**2. Phase 2: Registration + payments (1–2 weeks)**
   - `/join` flow: select night → enter details → Stripe/Local payment.
   - Payment confirmation webhook.
   - Seeding logic (random or admin-controlled).
   - Waitlist auto-promotion when entry drops.

**3. Phase 3: Player score reporting + disputes (1–2 weeks)**
   - Player profile page (results, history).
   - Score report form with screenshot upload to R2/S3.
   - Matched / dispute workflow.
   - Dispute queue in admin UI for organiser review.

**4. Phase 4: Live overlay + spectator features (1 week)**
   - `/overlay/:night_id` OBS-transparent page with auto-refresh SSE data.
   - "Now playing" banner with player names, match status, stream URL.
   - Bracket tree component rendered from live SSE data.

**5. Phase 5: Hermes automations (1 week)**
   - SMS/email reminders via cron jobs.
   - Post-round recap generator + social post draft.
   - Automated circuit table at weekend end.
   - Dispute triage summary (Hermes generates suggested ruling).

**6. Phase 6: Polish & extras (1–2 weeks)**
   - Season archive, full player profiles with H2H stats.
   - Sponsor slots / sponsor page section.
   - Preview of upcoming circuit dates on home page.
   - Dark mode toggles (if not already enforced by theme).

---

## 9. Security & compliance notes

- **Payment processing:** if using a local UAE gateway, PCI scope remains with the gateway (hosted checkout/embedded SDK). Do NOT handle raw card data on your server.
- **GDPR / UAE PDPL:** data stored in UAE region = falls under regional data laws. Player PII (name, contact) needs consent for processing. Storage duration: retain 5 years or less per UAE tax/accounting law — purge after circuit season ends + X months.
- **Under-18 rule:** guard against minors entering real-money prizes; add `is_minor` check in seeding logic and payment flow.
- **Tournament integrity:** all score entry requires matching from *both* players. No manual score editing by organiser unless via dispute path (logged).

---

## 10. Open decisions for Elias (organiser) — collect these before launch

| Decision | Default suggested | Impact |
|----------|------------------|--------|
| First weekend cities & venues | Dubai, Ajman, Sharjah | Needs venue + streaming confirmation. In-person vs hybrid affects bracket format. |
| Entry fee amount | US$10–20 | Higher fee → more funding for prizes but lower participation rate. |
| Prize pool funder | Elias (or split across sponsors in Phase 6) | Determines how much real money is involved → permit implications. |
| Game mode per night | Mix of UT / KO or pick one | UT needs Ultimate Team cards; KO allows custom squads. Both are allowed. |
| Skill-prize vs. draw permit | Default: skill-based only (simpler legally) | If drawing random winners with paid entry, UAE DET permit required in Dubai. Avoid unless necessary. |
| Match rules (half length, difficulty, controller) | 10 min first half / 5 min second half / Standard difficulty / Own controller | Need to be published in `/rules` before each night. |

---

> Last reviewed: 2026-03-24 (original). Expanded here with full technical architecture and dev tasks. No changes from original intent.
