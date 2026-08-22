/**
 * Anonymized Diagnostic Telemetry Dispatcher
 * 
 * STRICT PRIVACY RULES:
 * 1. Dispatches ONLY if user has explicitly opted-in via Extension Settings.
 * 2. Transmits NO passenger names, emails, phone numbers, PNRs, or card tokens.
 * 3. Uses a one-way hashed session ID rotated daily.
 */

import { DiagnosticReport, AnonymizedTelemetryPayload } from '@irctc-tatkal/shared';
import { sha256Hex } from '../crypto/crypto';

export interface TelemetryConfig {
  analyticsApiUrl?: string;
  isOptedIn: boolean;
}

export class TelemetryDispatcher {
  private apiUrl: string;
  private isOptedIn: boolean;

  constructor(config: TelemetryConfig) {
    this.apiUrl = config.analyticsApiUrl || 'http://localhost:3002';
    this.isOptedIn = config.isOptedIn;
  }

  /**
   * Send anonymized diagnostic report to transparency service
   */
  async sendReportTelemetry(report: DiagnosticReport): Promise<boolean> {
    if (!this.isOptedIn) {
      console.log('[Telemetry] Skipped dispatch: user has opted out of diagnostic data sharing.');
      return false;
    }

    try {
      // 1. Generate one-way session hash (sessionId + date salt)
      const dateSalt = new Date().toISOString().slice(0, 10);
      const sessionHash = await sha256Hex(`${report.sessionId}_${dateSalt}`);

      // 2. Map quota
      let tatkalQuota: AnonymizedTelemetryPayload['tatkalQuota'] = 'AC_TATKAL';
      if (report.quota === 'TATKAL' && report.classType === 'SL') {
        tatkalQuota = 'NON_AC_TATKAL';
      } else if (report.quota === 'GENERAL') {
        tatkalQuota = 'GENERAL';
      }

      // 3. Construct strictly anonymized payload
      const payload: AnonymizedTelemetryPayload = {
        sessionHash,
        tatkalQuota,
        totalDurationMs: report.totalDurationMs,
        stages: report.stages.map((s) => ({
          stage: s.stage,
          durationMs: s.durationMs
        })),
        outcome: report.outcome as AnonymizedTelemetryPayload['outcome'],
        primaryBottleneckStage: report.bottleneck.stage,
        clientVersion: '1.0.0',
        timestamp: report.createdAt
      };

      const res = await fetch(`${this.apiUrl}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log('[Telemetry] Anonymized stage diagnostics dispatched successfully.');
        return true;
      } else {
        const err = await res.text();
        console.warn('[Telemetry] Dispatch rejected:', err);
        return false;
      }
    } catch (err) {
      console.warn('[Telemetry] Failed to dispatch telemetry:', err);
      return false;
    }
  }
}

