# Walkthrough: Tatkal Readiness & Transparency Layer for IRCTC (MVP)

All 5 phases of the **Tatkal Readiness & Transparency Layer** have been implemented, verified, and tested in accordance with the implementation plan and strict security/compliance guardrails.

---

## 🏛️ System Architecture Summary

The repository is organized into a modular multi-package workspace:

```
irctcV2/
├── package.json               # Root orchestration & scripts (build:all, test:all)
├── shared/                    # TypeScript data contracts, StageType enums, Diagnostic schemas
├── vault-service/             # Express + TS Zero-Knowledge Backend (Port 3001)
├── analytics-service/         # Express + TS Anonymized Telemetry Backend (Port 3002)
├── extension/                 # Manifest V3 Extension (React + Vite + Tailwind + Web Crypto)
├── dashboard/                 # Next.js / React + Tailwind + Recharts Public Portal (Port 3003)
└── mock-irctc/                # Simulated IRCTC Portal with Chaos Latency Slider (Port 3000)
```

---

## 🔒 Security & Compliance Safeguards Implemented

| Security Requirement | Implementation & Verification |
|---|---|
| **Zero IRCTC Credentials** | Extension never prompts for, stores, or transmits IRCTC usernames or passwords. |
| **Zero Automation / No CAPTCHA Bypass** | Human solves CAPTCHA; human clicks submit. Autofill *only* populates input values with native events. |
| **Zero-Knowledge Passenger Encryption** | Client-side **AES-GCM-256** + **PBKDF2** (100k iterations). Decryption keys never leave browser memory. |
| **Strict Plaintext Rejection** | Vault backend strictly audits and rejects unencrypted passenger data. |
| **PCI-DSS Tokenization** | Server stores only opaque tokens (`tok_sandbox_*`) and masked metadata. Raw card numbers / CVVs are rejected. |
| **Anonymized Opt-In Telemetry** | Diagnostics are hashed via **SHA-256** with rotating salts. Telemetry ingest strictly filters and rejects PII. |
| **Isolated DOM Selectors** | Versioned dictionary (`SELECTORS_V1`) with graceful fallback to manual timing HUD if selectors change. |

---

## 🧪 Automated Test Verification

All automated tests across all workspaces were executed and passed with 0 errors:

### 1. Vault Service Unit Tests (`vault-service/src/__tests__/vault.test.ts`)
- `[PASS]` User Signup with JWT generation
- `[PASS]` User Login with password verification
- `[PASS]` Zero-knowledge encrypted profile stored as ciphertext
- `[PASS]` Plaintext passenger data strictly rejected by Vault server
- `[PASS]` Encrypted profiles listed successfully for authenticated user
- `[PASS]` Payment token reference saved (no raw card data)
- `[PASS]` Raw card numbers and CVVs strictly rejected

### 2. Analytics Ingest Service Tests (`analytics-service/src/__tests__/analytics.test.ts`)
- `[PASS]` Valid anonymized telemetry batch ingested
- `[PASS]` Telemetry payload containing PII strictly rejected by privacy filter
- `[PASS]` Malformed telemetry payload rejected
- `[PASS]` Dashboard summary computes accurate aggregate statistics

### 3. Extension Cryptography & Timing Tests (`extension/src/modules/...`)
- `[PASS]` AES-GCM-256 Encrypt/Decrypt round-trip successful
- `[PASS]` Decryption correctly rejected with invalid master passphrase
- `[PASS]` SHA-256 one-way deterministic session hash verified
- `[PASS]` Recorded sequential timing stages with millisecond precision
- `[PASS]` Primary bottleneck correctly classified (e.g. `SEAT_AVAILABILITY_CHECK`)
- `[PASS]` Plain-language diagnostic explanation generated

---

## 🚀 Live Demo & Validation Guide

### 1. Start All Services
In 4 separate terminal windows, start:
```bash
# Terminal 1: Vault Service (Port 3001)
npm --workspace=vault-service run dev

# Terminal 2: Analytics Ingest Service (Port 3002)
npm --workspace=analytics-service run dev

# Terminal 3: Mock IRCTC Portal (Port 3000)
npm --workspace=mock-irctc run dev

# Terminal 4: Public Transparency Dashboard (Port 3003)
npm --workspace=dashboard run dev
```

### 2. Load Extension in Chrome or Edge
1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle on **Developer mode**.
3. Click **Load unpacked** and select:
   `c:\Users\kumar\OneDrive\Desktop\irctcV2\extension\dist`

### 3. Run End-to-End Demo
1. **Open Extension Popup**: View the live Tatkal countdown (targeting 10:00:00 AM IST) and API health latency.
2. **Configure Vault in Options**: Set master password, add 2 passengers, link RuPay test token, and save locally with AES-GCM encryption.
3. **Open Mock IRCTC (`http://localhost:3000`)**:
   - Set Latency Profile to **"🔥 Tatkal Peak Rush (4,500ms Server Latency)"**.
   - Search Trains ➔ Click **Book Now (Tatkal)**.
   - On the Passenger screen, click **⚡ 1-Click Vault Autofill** in the floating HUD overlay.
   - Observe instant population of passenger names, ages, berths, mobile number, and payment mode without auto-submitting.
   - Type the visual CAPTCHA (e.g. `9X4KT`) ➔ Proceed to Payment ➔ Confirm.
4. **View Diagnostic Report**:
   - Inspect the Gantt chart and plain-language bottleneck diagnosis ("IRCTC server latency consumed 68% of time").
5. **Inspect Public Dashboard (`http://localhost:3003`)**:
   - Observe real-time aggregate charts, failure cause distributions, and Tatkal rush hour curves.
