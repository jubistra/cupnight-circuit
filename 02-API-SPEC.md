# Cup Night Circuit — API Specification

Base URL: `https://api.cupsnight.com` (or your deployment domain)

All responses use JSON unless noted. Errors follow `{ ok: false, code: string, message: string }`.

## Authentication

### Register / Login
```typescript
// POST /auth/register
{ email: string, password: string, gamertag?: string, platform?: string }
→ 200 { token: string, user_id: number }

// POST /auth/login
{ email: string, password: string }
→ 200 { token: string, user_id: number }
```

### Player registration (/join)
```typescript
// POST /register (pre-auth)
// Returns a one-time code or confirmation link sent via SMS/email
{ night_id: number, gamertag: string, platform: string }
→ 200 { stage: 'code_sent' | 'payment_required' }

// POST /register/confirm
{ night_id: number, code_or_token: string, payment_info? }
→ 200 { entry_id: number, status: 'confirmed' | 'on_waitlist' }
```

### Payment webhook
```typescript
// Webhook endpoint — receives from Stripe/Telr/PayTabs
// POST /webhooks/payment (authenticated by signing)
{ event: string, paid_at: string, amount: number, currency: string, 
  stripe_payment_id?: string, local_gateway_ref?: string }
→ 200 { ok: true, entry_id: number }
```

### Tournament endpoints
```typescript
// GET /circuits — List all circuits (public)
{ season?: number } → 200 { circuits: Circuit[], total: number }

// POST /admin/circuits — Create circuit (organiser only)
{ name: string, season: number } → 200 { circuit_id: number }

// GET /admin/nights/:circuit_id — Get nights for a circuit (organiser only)
→ 200 { nights: Night[], total: number }

// POST /admin/nights — Create night (organiser only)
{ 
  circuit_id: number, city: string, venue: string, starts_at: datetime,
  capacity?: number, mode: 'kick_off' | 'ultimate_team',
  entry_fee: number, prize_pool: number, stream_url?: string 
} → 200 { night_id: number }

// GET /circuits/:id — Get circuit details (public)
→ 200 { circuit: Circuit, nights: Night[], standings: Standing[] }

// GET /nights/:id — Get night details + bracket (public)
→ 200 { 
    night: Night, 
    matches: Match[], 
    players_count: number, 
    stream_url?: string, 
    recap?: Recap 
}

// POST /admin/night/:id/seeds — Seed bracket (organiser only)
{ entries: [{ entry_id: number, round: 'qf' | 'sf' | 'f', slot: number }] }
→ 200 { matches_updated: number }

// POST /admin/night/:id/scores — Report match score (organiser or player)
{ 
  match_id: number, 
  reporter_entry_id: number, 
  score_a?: number, 
  score_b?: number, 
  pens_winner?: 'a' | 'b',
  proof_url?: string 
} → 200 { status: 'reported' | 'confirmed' | 'disputed' }

// GET /admin/night/:id/disputes — Get dispute queue (organiser only)
→ 200 { disputes: [{ match_id, reporter_a: ..., reporter_b: ..., proof_a: ..., proof_b: ... }] }

// POST /admin/night/:id/disputes/:match_id/rule — Resolve a dispute (organiser only)
{ 
  action: 'confirm_score' | 'manual_override', 
  score_a?: number, score_b?: number, 
  message?: string 
} → 200 { status: 'resolved' }

// GET /players/:tag — Player profile (public)
→ 200 { player: Player, history: [{ night_name, result }] }
```

### SSE Events (real-time bracket updates)
```typescript
// GET /events/bracket?night_id=:id
// Server streams:
// event: bracket-update
// data: {"match_id": 123, "score_a": 2, "score_b": 1, "status": "confirmed"}

// event: player-register
// data: {"gamertag": "PlayerA", "night_id": 456}

// event: circuit-table-update
// data: {"circuit_name": "Cup Night 2026", "standings": [...]}
```

## Data types (for API consumers)

```typescript
type Circuit = { 
  id: number, 
  name: string, 
  season: number, 
  status: 'planning' | 'open' | 'closed' | 'finished' 
}

type Night = { 
  id: number, 
  circuit_id: number, 
  city: string, 
  venue: string, 
  starts_at: string, 
  capacity: number, 
  mode: 'kick_off' | 'ultimate_team', 
  entry_fee: number, 
  prize_pool: number, 
  status: 'planning' | 'open' | 'started' | 'completed', 
  stream_url?: string 
}

type Player = { 
  id: number, 
  gamertag: string, 
  platform: 'psn' | 'xbox' | 'steam' | 'pc', 
  contact: string, 
  is_minor: boolean 
}

type Entry = { 
  id: number, 
  night_id: number, 
  player_id: number, 
  seed: number, 
  paid: boolean, 
  status: 'confirmed' | 'dropped' | 'on_waitlist' 
}

type Match = { 
  id: number, 
  night_id: number, 
  circuit_id: number, 
  round: 'qf' | 'sf' | 'f', 
  slot: number, 
  a_entry_id?: number, 
  b_entry_id?: number, 
  score_a?: number, 
  score_b?: number, 
  winners: string,
  status: 'pending' | 'reported' | 'confirmed' | 'disputed' 
}

type Standing = { 
  circuit_id?: number, 
  night_id?: number, 
  place: number, 
  points: number, 
  players: { gamertag: string, platform: string } 
}

type Recap = { 
  text: string,
  social_draft: string,
  results_card: string 
}
```

## Error codes

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | Invalid or missing auth header |
| `FORBIDDEN` | Authenticated but not an organiser |
| `NIGHT_CLOSED` | Night is past start time |
| `SLOT_FULL` | Night capacity reached |
| `SCORE_MISMATCH` | Player reported scores don't match |
| `INVALID_ENTRY` | Entry doesn't exist or isn't paid |
| `NOT_FOUND` | Resource not found |
