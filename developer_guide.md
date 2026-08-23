# IRCTC Tatkal Layer — Complete Developer Reference Guide

---

## 1. What This Project Is (In One Paragraph)

This is a **browser extension + supporting microservices** that helps users during the 60-second IRCTC Tatkal ticket booking rush window. It does **not** automate bookings. Instead it:
- Keeps passenger details encrypted in your browser (AES-GCM-256)
- Pre-fills the IRCTC form in < 50ms with a single click (you still hit submit)
- Records every stage of your booking attempt in milliseconds (`performance.now()`)
- After booking, generates a plain-language report: *"IRCTC server took 4.2s. Your typing took 0.05s."*
- Aggregates that timing data anonymously on a public dashboard so railway passengers can see IRCTC's real server performance

---

## 2. The 5 Components & Ports at a Glance

| Component | Folder | Port | Tech Stack | What It Is |
|---|---|---|---|---|
| **Shared Contracts** | `shared/` | — | TypeScript | Common types used by all other packages |
| **Vault Service** | `vault-service/` | `3001` | Express + TS | Backend that stores encrypted passenger blobs |
| **Analytics Service** | `analytics-service/` | `3002` | Express + TS | Receives anonymized timing events, powers dashboard |
| **Mock IRCTC Portal** | `mock-irctc/` | `3000` | Express + HTML/JS | Simulated booking flow you can test against |
| **Transparency Dashboard** | `dashboard/` | `3003` | React + Recharts | Public chart of IRCTC timing performance |
| **Browser Extension** | `extension/` | — (Chrome/Edge) | React + Vite + MV3 | The actual extension you install in your browser |

---

## 3. Prerequisites & Setup

### Requirements
- **Node.js** v20 or v24+ (`node --version`)
- **npm** v10 or v11+ (`npm --version`)
- **Google Chrome** or Microsoft Edge

### First-Time Install + Build
```powershell
# In the project root (irctcV2/)
npm run build:all
```
This runs in sequence:
1. Compiles `shared/` TypeScript types
2. Compiles `vault-service/` backend
3. Compiles `analytics-service/` backend
4. Bundles `extension/` to `extension/dist/` (Chrome extension)
5. Builds `dashboard/` React app to `dashboard/dist/`
6. Compiles `mock-irctc/` backend

### Run All Tests
```powershell
npm run test:all
```
Tests: AES-GCM crypto round-trip, timing logger, zero-knowledge vault server, PII ingest filter.

---

## 4. Environment Variables (`.env` Files)

### `vault-service/.env`
```env
PORT=3001
JWT_SECRET=tatkal-vault-secret-change-this-in-production
DB_PATH=./data/vault_db.json
```
- **`PORT`** — Port the vault API listens on. Keep it `3001` unless you change all extension references too.
- **`JWT_SECRET`** — Secret used to sign JWT tokens. Change this in production. The extension never sees this.
- **`DB_PATH`** — Where the JSON "database" file lives. This is just for local/hackathon use. In production, swap with a real database.

### `analytics-service/.env`
```env
PORT=3002
EVENTS_FILE_PATH=./data/analytics_events.json
```
- **`PORT`** — Port the analytics API listens on.
- **`EVENTS_FILE_PATH`** — Where anonymized events are stored on disk.

> ⚠️ **You don't need to change any `.env` values to run the demo.** The defaults work out of the box. Only change `JWT_SECRET` if you deploy to a public server.

---

## 5. Running the Project (4 Terminals)

Open 4 separate terminal windows from the project root:

```powershell
# Terminal 1 — Zero-knowledge vault backend
npm --workspace=vault-service run dev

# Terminal 2 — Anonymized analytics ingest
npm --workspace=analytics-service run dev

# Terminal 3 — Simulated IRCTC booking portal
npm --workspace=mock-irctc run dev

# Terminal 4 — Public transparency dashboard
npm --workspace=dashboard run dev
```

Once all 4 are running:
| URL | What You'll See |
|---|---|
| `http://localhost:3000` | Fake IRCTC Tatkal booking flow |
| `http://localhost:3001/health` | `{"status":"ok"}` from vault API |
| `http://localhost:3002/health` | `{"status":"ok"}` from analytics API |
| `http://localhost:3003` | Interactive latency dashboard |

### Rebuilding After Code Changes
```powershell
# Rebuild only the extension (fastest during dev):
npm --workspace=extension run build

# Rebuild everything:
npm run build:all
```
After rebuilding the extension, go to `chrome://extensions` → click the **Refresh (↻)** icon on the "Tatkal Readiness Layer" card.

---

## 6. Installing the Browser Extension

1. Build the extension first: `npm --workspace=extension run build`
2. Open Chrome → `chrome://extensions` (or Edge → `edge://extensions`)
3. Toggle **Developer mode** ON (top-right corner)
4. Click **Load unpacked**
5. Select this folder: `c:\Users\kumar\OneDrive\Desktop\irctcV2\extension\dist`
6. Pin the **⚡ Tatkal Readiness Layer** extension to your toolbar

> If you make code changes and rebuild, click the **↻ refresh** icon in `chrome://extensions` — no need to reload the extension from disk again.

---

## 7. Detailed File & Function Reference

### A. `shared/src/index.ts` — Common Type Contracts

| Export | What It Is |
|---|---|
| `enum StageType` | The 8 named booking stages: `PAGE_LOAD`, `TRAIN_SEARCH`, `SEAT_AVAILABILITY_CHECK`, `PASSENGER_FORM_OPEN`, `AUTOFILL_EXECUTION`, `CAPTCHA_DISPLAYED`, `PAYMENT_GATEWAY_INTERACTION`, `BOOKING_CONFIRMATION` |
| `interface Passenger` | `{ id, name, age, gender, berthPreference, foodPreference }` |
| `interface PassengerVaultData` | The full vault payload: array of `Passenger[]` + preferences (mobile, auto-upgrade, payment method) |
| `interface EncryptedVaultBlob` | What gets sent to the server: `{ ciphertext, iv, salt, version }` — zero plaintext |
| `interface PaymentTokenRef` | Opaque token reference: `{ tokenRef, provider, cardLast4, cardNetwork, label }` — no raw card data |
| `interface DiagnosticReport` | Post-booking report: stages array, `totalDurationMs`, `primaryBottleneck`, `plainLanguageSummary`, `outcome` |
| `interface AnonymizedTelemetryPayload` | What gets sent to analytics: one-way SHA-256 hashed `sessionHash`, stage timings, no PII |

---

### B. Browser Extension (`extension/src/`)

#### `modules/crypto/crypto.ts` — Zero-Knowledge Encryption

| Function | What It Does |
|---|---|
| `encryptData(data, passphrase)` | 1) Generates random 16-byte salt, 2) Derives 256-bit key using PBKDF2 (100,000 iterations, SHA-256), 3) Generates random 12-byte IV, 4) Encrypts serialized JSON using AES-GCM-256, 5) Returns `{ ciphertext, iv, salt }` as Base64 strings |
| `decryptData(encrypted, passphrase)` | Re-derives the key from the same salt and decrypts. Throws `"Decryption failed"` if passphrase is wrong |
| `sha256Hex(input)` | One-way hash used to anonymize session IDs before sending telemetry |

> **Why PBKDF2 100,000 iterations?** To make brute-force attacks on the passphrase computationally expensive. On modern hardware, each guess takes ~100ms.

---

#### `modules/timing/timing-logger.ts` — Millisecond Stage Timer

| Method | What It Does |
|---|---|
| `startStage(stage)` | Calls `performance.now()` to capture the stage start time, ends the previous stage automatically |
| `endCurrentStage()` | Records `performance.now()` as the end time for the current stage |
| `generateReport(outcome)` | Calculates duration per stage, identifies the bottleneck stage (longest duration), builds a plain-language summary string like *"IRCTC PRS server caused 68% of total delay"*, returns a `DiagnosticReport` |

---

#### `modules/forms/form-detector.ts` + `selectors/v1/index.ts` — Screen Detection

| Function | What It Does |
|---|---|
| `SELECTORS_V1` (object) | Dictionary of CSS selectors for each IRCTC screen and form field. Examples: `passengerName: 'input[formcontrolname="passengerName"]'`, `captchaInput: 'input[placeholder*="captcha" i]'` |
| `formDetector.detectScreen(document)` | Scans the live DOM against `SELECTORS_V1`. Returns `{ activeScreen, detectedFields, confidence, manualFallback }`. If it can't identify the screen, sets `manualFallback: true` |

> **Why version-gated selectors?** IRCTC changes its HTML periodically. By namespacing selectors as `v1`, `v2`, etc., the extension can ship updated selectors without breaking old ones.

---

#### `modules/autofill/autofill.ts` — Safe Form Filling

| Function | What It Does |
|---|---|
| `fillPassengerDetails(vaultData, rootElement)` | For each passenger row in the DOM: sets `input.value`, then dispatches a native `InputEvent` (`bubbles: true`) and a `change` Event. This is required because React/Angular forms listen to synthetic events, not direct `.value` changes |

> **No auto-submit**: The function only touches `<input>` and `<select>` elements. It has no code that could call `.submit()`, `.click()` on a submit button, or trigger navigation. This is the core compliance guarantee.

---

#### `modules/readiness/readiness-check.ts` — Pre-Booking Checklist

| Function | What It Does |
|---|---|
| `runReadinessCheck(input)` | 1) Pings `http://localhost:3001/health` to measure vault API latency, 2) Compares server timestamp vs local clock to detect NTP skew > 500ms, 3) Checks `chrome.storage.local` for `masterKeyUnlocked` flag, 4) Calculates seconds until next 10:00:00 AM IST, returns a `ReadinessCheckResult` |

---

#### `modules/telemetry/telemetry.ts` — Opt-In Anonymous Reporting

| Function | What It Does |
|---|---|
| `sendReportTelemetry(report)` | 1) Checks `userSettings.telemetryOptIn` in chrome.storage, 2) Strips all sensitive fields, 3) Hashes the session ID with today's date as salt (`sha256Hex(sessionId + todayDateString)`), 4) POSTs to `http://localhost:3002/events/batch` |

---

#### `content/index.tsx` — Content Script (Injected Into Every Page)

This is the main orchestrator script that Chrome injects into every webpage matching the extension's `host_permissions`.

**Key logic:**
- Creates one persistent `<div id="irctc-tatkal-extension-root">` in the page's DOM
- Creates one `ReactDOM.createRoot()` and **never recreates it** (fixes the HUD flicker bug)
- Uses a `MutationObserver` to watch for DOM changes (for SPA navigation)
- On each DOM change: calls `formDetector.detectScreen()` → if screen changed, advances the `timingLogger` stage → re-renders `<Overlay>`

---

#### `content/Overlay.tsx` — The Floating HUD

This is the orange `⚡ Tatkal` widget that appears in the top-right of the page.

**UI states:**
- **Default**: Shows current stage name + elapsed stopwatch + a dimmed "⚡ 1-Click Autofill" button
- **When `PASSENGER_DETAILS` detected**: Button turns orange/active; clicking it calls `autofill.fillPassengerDetails()`
- **After booking confirmation**: Shows "📊 Generate Report" button → opens a modal with the Gantt chart

---

#### `popup/index.tsx` — Extension Toolbar Popup

Opens when you click the ⚡ icon in Chrome's toolbar. Shows:
- Countdown clock to next 10:00:00 AM IST
- API latency status (green = < 200ms, yellow = 200–500ms, red = > 500ms)
- Clock skew warning if your system clock is off by more than 500ms
- Link to open the Options page

---

#### `options/index.tsx` — Extension Options Page (4 Tabs)

| Tab | What You Do Here |
|---|---|
| **🔒 Passenger Vault** | Enter master passphrase, add/edit up to 4 passengers, set mobile number, toggle auto-upgrade, click **Save & Encrypt Locally** or **Sync Ciphertext to Vault API** |
| **💳 Payment Tokenization** | View linked RuPay/UPI tokens, generate sandbox test tokens |
| **🛡️ Privacy & Consent** | Toggle opt-in telemetry, toggle strict local-only mode |
| **📈 Diagnostic History** | View past booking attempt reports with timing breakdowns |

**How "Sync to Vault API" works (and why you saw a 409 error):**
1. Encrypts vault data with your passphrase in the browser (passphrase never sent to server)
2. Tries to **login** first with email `user@tatkal.local` + your passphrase
3. If login fails (account doesn't exist yet), **creates the account** with signup
4. Uploads only the encrypted ciphertext blob to the server

> The 409 "email already exists" error was a bug where the code tried **signup first** every time instead of **login first**. This is now fixed — it always tries login first.

---

### C. `vault-service/src/` — Zero-Knowledge Vault Backend

#### `server.ts`
Express app on port 3001. Mounts `/auth`, `/profiles`, `/payment-tokens` routers. Has CORS configured for `localhost:*`.

#### `auth/authController.ts`

| Route | Method | What It Does |
|---|---|---|
| `/auth/signup` | `POST` | Takes `{ email, password }`, hashes password with bcrypt (10 rounds), creates user in DB, returns JWT |
| `/auth/login` | `POST` | Takes `{ email, password }`, verifies bcrypt hash, returns JWT (30-day expiry) |
| `/auth/me` | `GET` | Returns current user info from JWT — no password hash returned |

#### `profiles/profilesController.ts`

| Route | Method | What It Does |
|---|---|---|
| `GET /profiles` | Auth required | Returns all ciphertext blobs for the logged-in user |
| `POST /profiles` | Auth required | **Zero-knowledge guard**: Rejects requests containing unencrypted `passengers` or `password` fields (HTTP 400). Accepts only `{ profileName, ciphertext, iv, salt, version }` |
| `DELETE /profiles/:id` | Auth required | Deletes a profile blob |

#### `payments/paymentsController.ts`

| Route | Method | What It Does |
|---|---|---|
| `GET /payment-tokens` | Auth required | Lists stored token references |
| `POST /payment-tokens` | Auth required | **PCI-DSS guard**: Rejects any request containing `cardNumber`, `cvv`, `pin`, `fullCardNumber` (HTTP 400). Stores only `{ tokenRef, provider, cardLast4, label }` |
| `POST /payment-tokens/sandbox-generate` | Public | Generates a fake `tok_sandbox_XXXX` reference for testing |

#### `database/db.ts`
A simple JSON file adapter (`vault_db.json`). Functions: `findUserByEmail`, `findUserById`, `createUser`, `getProfilesByUserId`, `createProfile`, `deleteProfile`. In production, replace this with PostgreSQL or MongoDB.

---

### D. `analytics-service/src/` — Anonymized Telemetry Backend

#### `events/eventsController.ts`

| Function | What It Does |
|---|---|
| `containsPii(obj)` | Recursively checks an object's keys and string values against a blocklist: `['name', 'email', 'phone', 'mobile', 'card', 'password', 'pnr', 'address', 'aadhaar']`. Returns `true` if any match found |
| `ingestBatch` (`POST /events/batch`) | Calls `containsPii()` on the request body — rejects with HTTP 400 if any PII detected. Otherwise appends events to the JSON event store |

#### `dashboard/dashboardController.ts`

| Function | What It Does |
|---|---|
| `getSummary` (`GET /dashboard/summary`) | Reads all stored events, aggregates: total attempts, success rate, average stage durations, peak latency by time-of-day, top 3 failure causes. Returns pre-computed JSON for the React dashboard |

#### `database/eventStore.ts`
Auto-seeds 180 realistic Tatkal attempt records across the 09:55–10:10 AM IST window on first launch (so the dashboard has something to show immediately). Each record has stage timings but zero PII.

---

### E. `mock-irctc/public/` — Simulated Booking Portal

#### `public/index.html` + `public/app.js`

Implements a realistic 6-screen IRCTC flow as plain HTML/JS:

| Screen | How to Reach It | CSS Markers (for extension's form-detector) |
|---|---|---|
| Train Search | Landing page | `#train-search-form` present |
| Train Results | Click "Find Trains" | `#search-results` present |
| Passenger Details | Click "⚡ Book Now (Tatkal)" | `#passenger-form` + `input[name="passengerName"]` present |
| Review & CAPTCHA | Click "Continue" | `#captcha-section` + `#captcha-input` present |
| Payment Gateway | Enter CAPTCHA + proceed | `#payment-gateway` present |
| Booking Confirmation | Click "Pay & Confirm" | `#booking-confirmation` + `#pnr-number` present |

**Chaos/Latency selector** (in the top bar):
- `Normal (250ms)` — IRCTC on a good day
- `Tatkal Peak Rush (4,500ms)` — PRS server under load
- `Bank Gateway Delays (8,000ms)` — Payment gateway timeout simulation
- `Seats Exhausted` — Booking fails, shows waitlist message

---

### F. `dashboard/src/App.tsx` — Public Transparency Dashboard

Built with React + Tailwind + Recharts. Fetches from `http://localhost:3002/dashboard/summary` every 30 seconds.

| Widget | Recharts Component | Data Source |
|---|---|---|
| KPI Cards (total attempts, avg duration, success rate) | plain div | `summary.totalAttempts`, `summary.successRate` |
| Tatkal Window Latency Curve | `AreaChart` | `summary.hourlyRushCurve` (avg ms by minute) |
| Failure Cause Breakdown | `PieChart` (donut) | `summary.failureCauses` |
| Stage Bottleneck Ranking | `BarChart` (horizontal) | `summary.stageDurationAvg` |
| Recent Telemetry Feed | plain list | `summary.recentSessions` (last 6, anonymized) |

---

## 8. Data Flow Diagram (How It All Connects)

```
Your Browser (Extension)
│
│── [POPUP] Shows countdown to 10:00 AM IST + API latency
│
│── [OPTIONS] You enter passphrase + passenger data
│       │
│       │ encryptData(vaultData, passphrase)      ← AES-GCM-256, local only
│       │
│       └──► POST /profiles (ciphertext only) ──► vault-service:3001
│
│── [CONTENT SCRIPT] Injected into http://localhost:3000 (mock portal)
│       │
│       │ Watches DOM via MutationObserver
│       │ Detects screen: TRAIN_SEARCH → PASSENGER_DETAILS → etc.
│       │ Records performance.now() for each stage transition
│       │
│       ├──► <Overlay /> (floating HUD)
│       │       │
│       │       └──► "⚡ 1-Click Autofill" → fillPassengerDetails()
│       │               (dispatches native input events, no auto-submit)
│       │
│       └──► After confirmation: generateReport() → Gantt modal
│               │
│               └──► sendReportTelemetry() ──► POST /events/batch ──► analytics-service:3002
│
analytics-service:3002
│
└──► GET /dashboard/summary ──► dashboard:3003 (React charts)
```

---

## 9. Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `409 Conflict — email already exists` when syncing vault | **Fixed in latest build.** Old code tried signup first. New code tries login first. | Rebuild extension: `npm --workspace=extension run build`, reload in `chrome://extensions` |
| Floating HUD not appearing | **Fixed in latest build.** `ReactDOM.createRoot` was called on every DOM mutation. | Same — rebuild + reload extension |
| `Could not authenticate with Vault Backend` | vault-service not running, OR you changed your master passphrase after first signup | Start vault: `npm --workspace=vault-service run dev`. If passphrase changed, delete `vault-service/data/vault_db.json` and retry. |
| `npm error EJSONPARSE — Unexpected end of JSON input` | A `package.json` file is empty (0 bytes) — can happen if disk write is interrupted | Check which file is empty: `Get-ChildItem -Recurse -Filter "package.json" \| Where-Object { \$_.Length -eq 0 }` and rewrite it. All package.json files should be non-empty after `npm run build:all`. |
| Extension shows "Content script error" | Extension is loaded from an old `dist/` build | Rebuild: `npm --workspace=extension run build`, then refresh extension in `chrome://extensions` |
| Dashboard shows no data | analytics-service not running | Start: `npm --workspace=analytics-service run dev` — it auto-seeds 180 benchmark records on startup |
| Autofill does nothing | Vault not unlocked | Open extension Options page → enter passphrase → click **Save & Encrypt Locally** |

---

## 10. Step-by-Step Demo Walkthrough (Corrected)

### Before You Start
1. Run all 4 services (4 terminals as shown in Section 5)
2. Build and load the extension (`extension/dist`)
3. Open `http://localhost:3003` — you should see the dashboard with pre-seeded data

### Step 1: Set Up the Vault
1. Click the ⚡ extension icon → click **Open Options / Manage Vault**
2. On the **Passenger Vault** tab, type a passphrase (e.g. `tatkal2026`)
3. Edit passenger names/ages as desired (defaults: Aditya Verma + Sunita Verma)
4. Click **🔒 Save & Encrypt Locally** → green banner: *"Vault encrypted with AES-GCM-256 and saved locally!"*
5. *(Optional)* Click **☁️ Sync Ciphertext to Vault API** → green banner: *"Zero-knowledge ciphertext synced"*
   - If you get an error, make sure `vault-service` is running on port 3001

### Step 2: Open the Mock Portal
1. Navigate to `http://localhost:3000`
2. You should see the **⚡ Tatkal** orange widget in the **top-right corner**
3. If you don't see it, hard-refresh the page (Ctrl+Shift+R) then check `chrome://extensions` to verify the extension is enabled

### Step 3: Book a Ticket
1. Click **Find Available Trains** on the mock portal
2. Click **⚡ Book Now (Tatkal)** on any train result
3. On the **Passenger Details** screen — the HUD widget should say `PASSENGER DETAILS` in green
4. Click **⚡ 1-Click Vault Autofill** in the HUD — all fields populate instantly
5. Click **Continue to Review**
6. On the CAPTCHA screen, read the code displayed and type it into the box, click **Proceed to Payment**
7. Click **Pay ₹1,430 & Confirm Booking**

### Step 4: View the Diagnostic Report
1. On the confirmation screen, click **📊 Finish & Generate Report** in the HUD
2. A modal opens showing:
   - Total booking time in seconds
   - Color-coded Gantt timeline of every stage
   - Primary bottleneck: which stage ate the most time
   - Plain-language summary
3. Open `http://localhost:3003` to see your session's data reflected in the live charts (if telemetry opt-in is enabled)
