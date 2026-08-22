# Implementation Plan
## Tatkal Readiness & Transparency Layer for IRCTC

---

## 1. System Overview

Three components:
1. **Browser Extension (Client)** — runs alongside irctc.co.in, does readiness checks, pre-fills forms, captures timing diagnostics
2. **Vault Service (Backend)** — stores encrypted passenger profiles + tokenized payment refs
3. **Analytics Service (Backend)** — collects anonymized, opt-in diagnostic events and powers the public dashboard

```
┌─────────────────────┐        ┌──────────────────┐
│  Browser Extension   │──────▶│  Vault API        │
│  (Chrome/Edge, MV3)  │◀──────│  (profiles, auth)  │
└──────────┬───────────┘        └──────────────────┘
           │
           │ (opt-in, anonymized events)
           ▼
┌──────────────────────┐        ┌──────────────────┐
│  Analytics Ingest API │──────▶│  Dashboard (Web)  │
└──────────────────────┘        └──────────────────┘
```

---

## 2. Frontend — Browser Extension

**Stack:** Manifest V3, React + TypeScript, Vite (for extension bundling), Tailwind CSS

### 2.1 Structure
- **Content script** — injects an overlay panel on irctc.co.in pages; reads visible DOM state (read-only) to detect which screen the user is on (login, passenger form, payment, confirmation)
- **Background service worker** — manages timing hooks, communicates with Vault API, handles local encryption
- **Popup UI** — readiness check dashboard, profile management, past reports
- **Options page** — consent settings, data sharing opt-in/out, local-only mode toggle

### 2.2 Key Modules

| Module | Responsibility |
|---|---|
| `readiness-check.ts` | Pings latency-check endpoint, validates saved profile completeness, checks browser/network health |
| `form-detector.ts` | Detects which IRCTC screen is active via DOM selectors (versioned, since IRCTC markup can change) |
| `autofill.ts` | Fills detected form fields from local decrypted vault data — never auto-submits |
| `timing-logger.ts` | Uses `performance.now()` to timestamp stage transitions (page load → field fill start → CAPTCHA visible → submit click → response received → payment redirect → payment result) |
| `crypto.ts` | Client-side AES-GCM encryption (Web Crypto API) for locally cached passenger data |
| `report-generator.ts` | Builds the plain-language post-attempt report from collected timestamps |
| `telemetry.ts` | If opted in, sends anonymized (no PII) stage-timing events to Analytics Ingest API |

### 2.3 UI Screens
1. **Setup wizard** — create passenger profiles, link payment method (via tokenization, see 3.2)
2. **Readiness panel** — countdown to Tatkal window, live "Ready ✅ / Issues ⚠️" status
3. **Live diagnostics overlay** — small floating panel showing current stage during booking attempt
4. **Report screen** — stage-by-stage timeline chart (bar/gantt style) + plain-language summary
5. **History** — past attempts, personal bottleneck trends

### 2.4 DOM Interaction Safety
- Content script only **reads** field labels/positions and **writes** values into existing input fields the same way a user's keyboard would (dispatch native `input`/`change` events) — no interception of network requests, no form auto-submission, no CAPTCHA interaction
- Version-gate DOM selectors; if IRCTC changes their markup, fail gracefully to "manual mode" (extension just shows timers, no autofill) instead of breaking

---

## 3. Backend

### 3.1 Vault Service (profile + auth)

**Stack:** Node.js (NestJS or Express) + PostgreSQL + Redis (session cache)

**Responsibilities:**
- User auth (email/OTP or OAuth) — separate from IRCTC login, never touches IRCTC credentials
- Store encrypted passenger profiles (server stores ciphertext only; decryption key derived client-side from user's password, never sent to server — zero-knowledge design)
- Manage tokenized payment references via a PCI-DSS compliant processor (Razorpay/Stripe) — **raw card/UPI data never touches our servers**

**Key endpoints:**
```
POST   /auth/signup
POST   /auth/login
POST   /profiles              (encrypted blob upload)
GET    /profiles              (encrypted blob download)
PUT    /profiles/:id
DELETE /profiles/:id
POST   /payment-tokens        (proxies to Razorpay/Stripe tokenization)
```

**Data model (simplified):**
```
User            (id, email, password_hash, created_at)
PassengerVault  (id, user_id, encrypted_blob, iv, created_at, updated_at)
PaymentToken    (id, user_id, provider_token_ref, last4, created_at)
```

### 3.2 Payment Tokenization
- Never build custom card storage — always delegate to Razorpay/Stripe/PayU's tokenization APIs (this is standard, PCI-compliant, and removes an enormous compliance burden)
- Our DB stores only the opaque token reference, not card data

### 3.3 Analytics Ingest Service

**Stack:** Node.js + PostgreSQL (or TimescaleDB for time-series) + a queue (SQS/RabbitMQ) for burst handling during Tatkal windows (huge traffic spike at 10:00:00 AM)

**Responsibilities:**
- Accept anonymized event batches: `{ session_hash, stage, timestamp_delta, outcome }` — no user ID, no PII, session_hash is a one-way hash rotated per session
- Aggregate into rollups: failure-cause breakdown, average stage durations, time-of-day patterns

**Key endpoint:**
```
POST /events/batch      (rate-limited, validated against anonymization schema)
GET  /dashboard/summary (public, cached, powers the dashboard)
```

**Why a queue matters here:** all traffic spikes in the same 60-second window nationally (10:00 AM Tatkal opening) — ingestion must handle burst load without blocking the extension's own diagnostics.

### 3.4 Dashboard (Public Web)

**Stack:** Next.js + Tailwind + a charting lib (Recharts)
- Publicly accessible, no login required
- Shows daily/weekly aggregated failure-cause breakdown, trends over time
- Cached (e.g., 5-minute TTL) since it's read-heavy and doesn't need real-time precision

---

## 4. Infrastructure

| Layer | Choice (hackathon-appropriate) |
|---|---|
| Hosting | Vercel (dashboard + Next.js), Railway/Render (backend services) — fast to deploy, free tiers sufficient for MVP |
| Database | Supabase/Neon (managed Postgres) |
| Queue | Upstash (managed Redis/queue) — serverless, no ops overhead |
| Auth | Supabase Auth or Clerk |
| Payment tokenization | Razorpay test mode (sandbox keys) |
| Extension distribution | Unpacked/dev mode for demo; Chrome Web Store submission post-hackathon |

For a hackathon, skip Kubernetes/heavy DevOps entirely — managed serverless services get you a working demo fastest.

---

## 5. Security & Compliance Checklist

- [ ] Client-side, zero-knowledge encryption for passenger vault (server never sees plaintext)
- [ ] No raw payment data stored anywhere in our system — tokenization only
- [ ] No interception/modification of IRCTC's network requests
- [ ] No auto-submission of forms or CAPTCHA bypass — human performs every action
- [ ] Analytics events are non-attributable (hashed session IDs, no PII, no IP logging beyond standard rate-limiting needs)
- [ ] Explicit opt-in consent screen before any data leaves the user's device
- [ ] Clear ToS-compliance statement in extension listing: "This tool does not automate booking or interact with IRCTC servers on your behalf"

---

## 6. Build Sequence (Hackathon Timeline)

**Phase 1 (Hours 0–4): Core skeleton**
- Extension boilerplate (Manifest V3 + React overlay injection on a test page)
- Basic timing-logger capturing dummy stage events
- Simple Vault API with mock auth (skip real OTP for demo)

**Phase 2 (Hours 4–10): Core features**
- Passenger profile form + client-side encryption + save/load from Vault API
- DOM detector for IRCTC's actual booking flow (build against real site structure, read-only)
- Autofill working end-to-end on a staging/mock IRCTC-like form (since live-testing against real IRCTC during dev is risky/rate-limited)

**Phase 3 (Hours 10–16): Diagnostics + reporting**
- Full stage-timing pipeline (page load → CAPTCHA → submit → payment → result)
- Report generator UI (timeline chart + plain-language summary)
- Analytics ingest endpoint + basic aggregation

**Phase 4 (Hours 16–20): Dashboard + polish**
- Public dashboard with mock/seeded aggregate data
- Onboarding/setup wizard UI polish
- Consent/privacy screens

**Phase 5 (Hours 20–24): Demo prep**
- Simulated Tatkal environment (mock site with artificial network delay) for a reliable live demo
- Slide deck + before/after demo script
- README + compliance statement

---

## 7. Team Split (suggested, 4-person team)

| Role | Owns |
|---|---|
| Extension/Frontend Dev | Content script, overlay UI, autofill, timing logger |
| Backend Dev | Vault API, Analytics Ingest, DB schema, tokenization integration |
| Full-stack/Dashboard Dev | Next.js dashboard, report generator UI, charts |
| Product/Demo Lead | Mock Tatkal test environment, PRD/pitch, demo script, security checklist review |

---

## 8. Post-Hackathon Roadmap (if pursued further)

1. Chrome Web Store submission + real user testing during an actual Tatkal window (opt-in beta)
2. Legal review of extension's ToS positioning
3. Partnership/RTI outreach using aggregated dashboard data to push IRCTC/CRIS toward transparency
4. Extend to other high-traffic booking moments (e.g., festival special trains)
