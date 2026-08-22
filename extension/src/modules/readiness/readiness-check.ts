/**
 * Tatkal Readiness Checker
 * 
 * Validates pre-conditions before Tatkal opening:
 * 1. Decrypted profile availability
 * 2. Payment token readiness
 * 3. Network ping & latency to API
 * 4. System clock skew vs server time
 * 5. Tatkal countdown calculation (10:00 AM AC / 11:00 AM Non-AC)
 */

import { ReadinessCheckResult, PassengerVaultData } from '@irctc-tatkal/shared';

export interface ReadinessCheckInput {
  vaultData: PassengerVaultData | null;
  hasPaymentToken: boolean;
  vaultApiUrl?: string;
}

export async function runReadinessCheck(input: ReadinessCheckInput): Promise<ReadinessCheckResult> {
  const warnings: string[] = [];
  const apiUrl = input.vaultApiUrl || 'http://localhost:3001';

  // 1. Vault checks
  const vaultDecrypted = input.vaultData !== null && Array.isArray(input.vaultData.passengers);
  const passengerCount = input.vaultData?.passengers?.length || 0;

  if (!vaultDecrypted) {
    warnings.push('Passenger Vault is locked. Enter your master passphrase to unlock.');
  } else if (passengerCount === 0) {
    warnings.push('No passengers saved in your active vault profile.');
  } else if (passengerCount > 4) {
    warnings.push(`Tatkal limits max 4 passengers per PNR (you have ${passengerCount}).`);
  }

  // 2. Payment token check
  if (!input.hasPaymentToken) {
    warnings.push('No quick payment token configured. Setup RuPay/UPI token in Options.');
  }

  // 3. Network Latency & Clock Skew Probe
  let networkLatencyMs = 0;
  let irctcDomainReachable = true;
  let clockSkewMs = 0;

  try {
    const t0 = performance.now();
    const clientPreEpoch = Date.now();
    const res = await fetch(`${apiUrl}/health`, { method: 'GET', cache: 'no-store' });
    const t1 = performance.now();
    networkLatencyMs = Math.round(t1 - t0);

    if (res.ok) {
      const data = await res.json();
      if (data.serverTimeEpochMs) {
        const clientMidEpoch = clientPreEpoch + networkLatencyMs / 2;
        clockSkewMs = Math.round(data.serverTimeEpochMs - clientMidEpoch);
      }
    }
  } catch (err) {
    networkLatencyMs = 999;
    irctcDomainReachable = false;
    warnings.push('Local Vault API service is not reachable.');
  }

  if (networkLatencyMs > 600) {
    warnings.push(`High network latency detected (${networkLatencyMs}ms). Consider a low-latency connection.`);
  }

  if (Math.abs(clockSkewMs) > 1500) {
    warnings.push(`System clock is skewed by ${Math.abs(clockSkewMs)}ms. Sync system clock to Indian Standard Time (IST).`);
  }

  // 4. Tatkal countdown calculation (IST: UTC+5:30)
  const now = new Date();
  // Target AC: 10:00:00 AM today (or tomorrow if past 10:00 AM)
  const acTatkal = new Date(now);
  acTatkal.setHours(10, 0, 0, 0);

  // Target Non-AC: 11:00:00 AM today
  const nonAcTatkal = new Date(now);
  nonAcTatkal.setHours(11, 0, 0, 0);

  let tatkalType: 'AC' | 'NON_AC' | 'NONE' = 'AC';
  let targetTime = acTatkal;
  let secondsRemaining = Math.round((acTatkal.getTime() - now.getTime()) / 1000);

  if (secondsRemaining < -600 && now.getHours() < 11) {
    // Past 10:10 AM, next is 11:00 AM Non-AC
    tatkalType = 'NON_AC';
    targetTime = nonAcTatkal;
    secondsRemaining = Math.round((nonAcTatkal.getTime() - now.getTime()) / 1000);
  } else if (secondsRemaining < 0 && secondsRemaining >= -600) {
    // Currently active window!
    tatkalType = 'AC';
  } else if (secondsRemaining < -3600) {
    // Next day AC
    acTatkal.setDate(acTatkal.getDate() + 1);
    secondsRemaining = Math.round((acTatkal.getTime() - now.getTime()) / 1000);
  }

  const isWindowActive = secondsRemaining <= 0 && secondsRemaining >= -900;

  const isReady = vaultDecrypted && passengerCount > 0 && warnings.length === 0;

  return {
    isReady,
    checks: {
      vaultDecrypted,
      passengerCount,
      paymentTokenConfigured: input.hasPaymentToken,
      networkLatencyMs,
      irctcDomainReachable,
      clockSkewMs
    },
    tatkalWindow: {
      type: tatkalType,
      secondsRemaining: Math.max(0, secondsRemaining),
      targetTime: targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isWindowActive
    },
    warnings
  };
}

