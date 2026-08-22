# Tatkal Readiness & Transparency Layer for IRCTC

A modular, security-compliant, hackathon-ready platform designed to bring transparency, speed, and diagnostic clarity to the high-stakes IRCTC Tatkal booking window without automating form submission or violating regulatory guardrails.

---

## 🏗️ System Architecture

The solution consists of 5 modular services:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER EXTENSION                             │
│  Manifest V3 (React + TypeScript + Vite + Tailwind CSS + Web Crypto)    │
│  - Background Service Worker       - Readiness Checklist & Countdown    │
│  - Isolated DOM Selector Detector   - 1-Click Native Autofill Engine     │
│  - High-Res Timing Diagnostics HUD - Plain-Language Report Generator    │
└────────────────┬───────────────────────────────────────┬────────────────┘
                 │ (Zero-Knowledge Ciphertext Blobs)     │ (Opt-in Anonymized Telemetry)
                 ▼                                       ▼
┌────────────────────────────────┐      ┌────────────────────────────────┐
│         VAULT SERVICE          │      │    ANALYTICS INGEST SERVICE    │
│   (Express + TS on Port 3001)  │      │   (Express + TS on Port 3002)  │
│  - User Auth (JWT/Bcrypt)      │      │  - Strict PII Filter & Queue   │
│  - Encrypted Ciphertext CRUD   │      │  - Anonymized Ingest (/batch)  │
│  - Tokenized Payment Refs      │      │  - Rollup Aggregation Engine   │
└────────────────────────────────┘      └────────────────┬───────────────┘
                                                         │
                                                         ▼
┌────────────────────────────────┐      ┌────────────────────────────────┐
│       MOCK TATKAL PORTAL       │      │       PUBLIC DASHBOARD         │
│   (Express + TS on Port 3000)  │      │   (React + Recharts on :3003)  │
│  - High-Fidelity IRCTC Portal  │      │  - Rush Hour Latency Curves    │
│  - Chaos & Latency Simulator   │      │  - Failure Cause Breakdown     │
│  - Realistic Booking Workflow  │      │  - Stage Bottleneck Rankings   │
└────────────────────────────────┘      └────────────────────────────────┘
```

---

## 🔒 Security & Compliance Safeguards (Non-Negotiable)

1. **Zero Automation / No CAPTCHA Bypass:** The extension *never* bypasses or solves CAPTCHAs, *never* intercepts IRCTC's network requests, and *never* auto-submits forms. All actions require deliberate human interaction.
2. **Client-Side Zero-Knowledge Encryption:** Passenger data is encrypted in-browser using **AES-GCM-256** with **PBKDF2** key derivation (100,000 iterations). Decryption keys are never sent to the backend. The Vault server only stores ciphertext blobs and IVs.
3. **PCI-DSS Compliant Payment Tokenization:** The backend *never* receives or stores raw card numbers, CVVs, or UPI PINs. Only opaque provider token references (e.g. `tok_sandbox_*`) are handled.
4. **Non-Attributable Opt-In Telemetry:** Diagnostic stage timing is collected only with explicit user consent. Sessions are hashed using a one-way **SHA-256** hash with daily rotating salts. PII is strictly filtered and rejected at ingest.

---

## 📦 Project Structure

```
irctcV2/
├── shared/              # Common TypeScript types, contracts, and timing schemas
├── vault-service/       # Zero-knowledge profile vault & payment token backend (Port 3001)
├── analytics-service/   # Anonymized telemetry ingest & aggregation service (Port 3002)
├── extension/           # Manifest V3 Chrome/Edge extension (Popup, Options, HUD Overlay)
├── dashboard/           # Public transparency & latency breakdown dashboard (Port 3003)
└── mock-irctc/          # Simulated Tatkal booking environment with latency controls (Port 3000)
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** `v20+` or `v24+`
- **npm** `v10+` or `v11+`
- **Google Chrome** or **Microsoft Edge**

### 2. Install & Build All Workspaces
In the project root directory, run:
```bash
# Build shared types, extension, dashboard, and backend services
npm run build:all
```

### 3. Run Automated Test Suite
To verify encryption round-trip, timing logger, zero-knowledge storage, and PII filters:
```bash
npm run test:all
```

---

## 🖥️ Running Services for Local Demo

You can start the backend services and frontends in separate terminal windows:

### Terminal 1: Start Vault Service (Port 3001)
```bash
npm --workspace=vault-service run dev
```

### Terminal 2: Start Analytics Ingest Service (Port 3002)
```bash
npm --workspace=analytics-service run dev
```

### Terminal 3: Start Mock IRCTC Tatkal Portal (Port 3000)
```bash
npm --workspace=mock-irctc run dev
```

### Terminal 4: Start Public Transparency Dashboard (Port 3003)
```bash
npm --workspace=dashboard run dev
```

---

## 🧩 Installing the Browser Extension

1. Open **Google Chrome** or **Microsoft Edge** and navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Enable **Developer mode** (toggle in top-right).
3. Click **Load unpacked**.
4. Select the `extension/dist` folder inside this repository:
   ```
   c:\Users\kumar\OneDrive\Desktop\irctcV2\extension\dist
   ```
5. Pin the **Tatkal Readiness Layer** extension to your browser toolbar.

---

## 🎬 End-to-End Hackathon Demonstration Walkthrough

Follow these steps for a complete live demonstration:

### Step 1: Open Extension & Readiness Checklist
1. Click the **Tatkal Readiness Layer** icon in the browser toolbar.
2. Observe the **Live Tatkal Countdown Clock** (targeting 10:00:00 AM IST) and the real-time **API Latency & Clock Skew (NTP)** status.
3. Click **Manage Passenger Vault** to open the Options page.

### Step 2: Configure Zero-Knowledge Passenger Vault
1. On the **Passenger Vault** tab, enter a master passphrase (e.g. `tatkal@master2026`).
2. Add passenger details (Name, Age, Gender, Berth Preference).
3. Click **Save & Encrypt Locally** (encrypts with AES-GCM-256 via Web Crypto).
4. Click **Sync Ciphertext to Vault API** (verifies zero-knowledge transmission).
5. Switch to the **Payment Tokenization** tab and click **+ Link Test RuPay Token** (generates a PCI-compliant token reference).

### Step 3: Open Mock Tatkal Booking Portal
1. Navigate to `http://localhost:3000`.
2. Notice the floating **Tatkal Diagnostics HUD** injected in the top-right corner.
3. In the top developer bar, select the simulation profile:
   - **Normal Conditions (250ms)**
   - **Tatkal Peak Rush (4,500ms Server Latency)**
   - **Bank Gateway Delays (8,000ms)**
4. Click **Find Available Trains** ➔ Click **⚡ Book Now (Tatkal)**.

### Step 4: 1-Click Native Autofill (No Auto-Submit)
1. When you arrive at the **Passenger Details** screen, the floating HUD detects `Passenger Details` and turns green.
2. Click **⚡ 1-Click Vault Autofill**.
3. All passenger rows, contact mobile, auto-upgrade, and payment preferences populate in **< 100ms** with native events dispatched.
4. Click **Continue to Review** (human action required).

### Step 5: Visual CAPTCHA & Payment
1. View the visual alphanumeric CAPTCHA box (e.g. `9X4KT`), type the code into the box, and click **Proceed to Payment**.
2. On the Payment Gateway screen, click **Pay ₹1,430 & Confirm Booking**.
3. Upon confirmation, click **Finish & Generate Report** on the floating HUD.

### Step 6: Diagnostic Report & Transparency Dashboard
1. The **Diagnostic Report Modal** displays:
   - **Plain-Language Summary**: Explaining total duration, PRS delay vs user input.
   - **Gantt / Stage Latency Timeline**: Color-coded breakdown of every stage.
   - **Primary Bottleneck Identification**: e.g., IRCTC PRS server delay or Payment gateway latency.
2. Click **View Public Dashboard** or navigate to `http://localhost:3003` to observe live aggregated metrics, latency spike curves, and failure cause distributions updating in real-time.

---

## 📜 API Documentation

### Vault Service (`http://localhost:3001`)
- `GET /health` — Latency check and server timestamp probe
- `POST /auth/signup` — Create user account with hashed password
- `POST /auth/login` — Authenticate and receive JWT
- `GET /profiles` — Retrieve encrypted ciphertext blobs for authenticated user
- `POST /profiles` — Store encrypted ciphertext blob (rejects plaintext passenger data)
- `POST /payment-tokens` — Store tokenized payment reference (rejects raw card numbers)
- `POST /payment-tokens/sandbox-generate` — Generate sandbox RuPay/UPI reference

### Analytics Service (`http://localhost:3002`)
- `GET /health` — Health and privacy mode probe
- `POST /events/batch` — Ingest anonymized stage timing batch (rejects any PII)
- `GET /dashboard/summary` — Public cached rollup metrics for transparency dashboard

