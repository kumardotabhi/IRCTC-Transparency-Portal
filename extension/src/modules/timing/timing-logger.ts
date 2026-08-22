/**
 * High-Resolution Timing Diagnostics Logger
 * 
 * Uses performance.now() to measure millisecond-accurate stage transitions:
 * PAGE_LOAD -> TRAIN_SEARCH -> PASSENGER_FORM -> AUTOFILL -> CAPTCHA -> REVIEW -> PAYMENT -> CONFIRMATION
 */

import { StageType, StageTimestamp, StageSummary, BottleneckAnalysis, DiagnosticReport } from '@irctc-tatkal/shared';

export interface TimingLoggerConfig {
  sessionId?: string;
  quota?: 'TATKAL' | 'PREMIUM_TATKAL' | 'GENERAL' | 'LADIES';
  trainNumber?: string;
}

export class TimingLogger {
  private sessionId: string;
  private quota: 'TATKAL' | 'PREMIUM_TATKAL' | 'GENERAL' | 'LADIES';
  private trainNumber?: string;
  private timestamps: StageTimestamp[] = [];
  private currentStage: StageType | null = null;
  private stageStartTime: number = 0;
  private sessionStartTime: number = 0;
  private isTatkalPeakWindow: boolean = false;

  constructor(config?: TimingLoggerConfig) {
    this.sessionId = config?.sessionId || `tatkal_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.quota = config?.quota || 'TATKAL';
    this.trainNumber = config?.trainNumber;
    this.checkPeakWindow();
  }

  private checkPeakWindow() {
    const now = new Date();
    // Tatkal windows: 10:00 AM (AC) and 11:00 AM (Non-AC) in IST
    const hours = now.getHours();
    const minutes = now.getMinutes();
    this.isTatkalPeakWindow = (hours === 9 && minutes >= 58) ||
                              (hours === 10 && minutes <= 10) ||
                              (hours === 10 && minutes >= 58) ||
                              (hours === 11 && minutes <= 10);
  }

  /**
   * Start a new stage transition.
   * Automatically closes the previous stage.
   */
  startStage(stage: StageType, metadata?: Record<string, string | number | boolean>): StageTimestamp {
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

    if (this.timestamps.length === 0) {
      this.sessionStartTime = now;
    }

    // End previous stage if active
    if (this.currentStage && this.timestamps.length > 0) {
      const prev = this.timestamps[this.timestamps.length - 1];
      if (!prev.endTime) {
        prev.endTime = now;
        prev.durationMs = Math.max(0, Math.round(now - prev.startTime));
      }
    }

    const stageRecord: StageTimestamp = {
      stage,
      startTime: now,
      metadata
    };

    this.timestamps.push(stageRecord);
    this.currentStage = stage;
    this.stageStartTime = now;

    return stageRecord;
  }

  /**
   * Complete the current stage.
   */
  endCurrentStage(): void {
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    if (this.timestamps.length > 0) {
      const current = this.timestamps[this.timestamps.length - 1];
      if (!current.endTime) {
        current.endTime = now;
        current.durationMs = Math.max(0, Math.round(now - current.startTime));
      }
    }
  }

  getTimestamps(): StageTimestamp[] {
    return this.timestamps;
  }

  getCurrentStage(): StageType | null {
    return this.currentStage;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Generate complete Diagnostic Report with plain language bottleneck analysis.
   */
  generateReport(outcome: DiagnosticReport['outcome'] = 'SUCCESS'): DiagnosticReport {
    this.endCurrentStage();

    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const totalDurationMs = Math.max(10, Math.round(now - this.sessionStartTime));

    const stageDescriptions: Record<StageType, string> = {
      [StageType.PAGE_LOAD]: 'Initial IRCTC page and assets loading',
      [StageType.TRAIN_SEARCH]: 'Submitting train query and fetching live results',
      [StageType.SEAT_AVAILABILITY_CHECK]: 'Querying IRCTC PRS for Tatkal seat availability count',
      [StageType.PASSENGER_FORM_OPEN]: 'Navigating into passenger booking input screen',
      [StageType.AUTOFILL_EXECUTION]: 'Decrypted vault autofill execution',
      [StageType.CAPTCHA_DISPLAYED]: 'Human CAPTCHA recognition and input delay',
      [StageType.FORM_SUBMISSION]: 'Reviewing and posting passenger details to IRCTC backend',
      [StageType.REVIEW_PAGE_LOAD]: 'Review & confirmation screen rendering',
      [StageType.PAYMENT_REDIRECT]: 'Handshake & redirection to banking gateway',
      [StageType.PAYMENT_GATEWAY_INTERACTION]: 'Bank OTP entry / UPI authentication processing',
      [StageType.PAYMENT_PROCESSING]: 'Payment gateway confirmation verification',
      [StageType.BOOKING_CONFIRMATION]: 'PNR generation and ticket confirmation page',
      [StageType.BOOKING_FAILURE]: 'Booking session interrupted or failed'
    };

    const stageSummaries: StageSummary[] = this.timestamps.map((t) => {
      const duration = t.durationMs || 0;
      const pct = Math.round((duration / totalDurationMs) * 100);
      let status: StageSummary['status'] = 'optimal';
      if (pct > 40 || duration > 5000) {
        status = 'bottleneck';
      } else if (pct > 20 || duration > 2500) {
        status = 'moderate';
      }

      return {
        stage: t.stage,
        stageName: t.stage.replace(/_/g, ' '),
        durationMs: duration,
        percentOfTotal: pct,
        status,
        description: stageDescriptions[t.stage] || t.stage
      };
    });

    // Identify primary bottleneck
    const sorted = [...stageSummaries].sort((a, b) => b.durationMs - a.durationMs);
    const topStage = sorted[0] || {
      stage: StageType.SEAT_AVAILABILITY_CHECK,
      stageName: 'SEAT AVAILABILITY CHECK',
      durationMs: 0,
      percentOfTotal: 0
    };

    const bottleneck: BottleneckAnalysis = this.analyzeBottleneck(topStage, totalDurationMs);

    // Generate plain-language summary
    const plainLanguageSummary = this.buildPlainLanguageSummary(stageSummaries, bottleneck, totalDurationMs, outcome);

    return {
      sessionId: this.sessionId,
      trainNumber: this.trainNumber || '12658',
      trainName: 'Bengaluru - Chennai Express',
      quota: this.quota,
      classType: '3A',
      startTimeIso: new Date(Date.now() - totalDurationMs).toISOString(),
      totalDurationMs,
      outcome,
      stages: stageSummaries,
      bottleneck,
      plainLanguageSummary,
      isTatkalPeakWindow: this.isTatkalPeakWindow,
      createdAt: new Date().toISOString()
    };
  }

  private analyzeBottleneck(topStage: StageSummary, totalMs: number): BottleneckAnalysis {
    const stage = topStage.stage;
    let category: BottleneckAnalysis['category'] = 'NETWORK_SERVER';
    let explanation = '';
    let recommendation = '';

    if (stage === StageType.SEAT_AVAILABILITY_CHECK || stage === StageType.TRAIN_SEARCH || stage === StageType.PAGE_LOAD) {
      category = 'NETWORK_SERVER';
      explanation = `IRCTC backend server latency during Tatkal rush consumed ${topStage.durationMs}ms (${topStage.percentOfTotal}% of total time).`;
      recommendation = 'Keep your readiness check green beforehand. Network/server congestion is on IRCTC side.';
    } else if (stage === StageType.CAPTCHA_DISPLAYED) {
      category = 'CAPTCHA_FRICTION';
      explanation = `CAPTCHA entry took ${topStage.durationMs}ms (${topStage.percentOfTotal}% of total time).`;
      recommendation = 'Practice quick visual CAPTCHA typing before 09:59:50 AM to shave 2-3 critical seconds.';
    } else if (stage === StageType.PAYMENT_GATEWAY_INTERACTION || stage === StageType.PAYMENT_REDIRECT) {
      category = 'GATEWAY_PROCESSING';
      explanation = `Payment gateway redirect and bank authentication took ${topStage.durationMs}ms (${topStage.percentOfTotal}%).`;
      recommendation = 'Use fast UPI auto-pay or pre-authenticated RuPay cards over Net Banking OTPs to save 4-6 seconds.';
    } else {
      category = 'USER_INTERACTION';
      explanation = `Stage ${topStage.stageName} took ${topStage.durationMs}ms.`;
      recommendation = 'Use automated 1-click vault pre-fill to minimize manual input delay.';
    }

    return {
      stage,
      stageName: topStage.stageName,
      durationMs: topStage.durationMs,
      category,
      impactPercentage: topStage.percentOfTotal,
      explanation,
      recommendation
    };
  }

  private buildPlainLanguageSummary(
    stages: StageSummary[],
    bottleneck: BottleneckAnalysis,
    totalMs: number,
    outcome: DiagnosticReport['outcome']
  ): string {
    const durationSec = (totalMs / 1000).toFixed(1);
    const autofillStage = stages.find((s) => s.stage === StageType.AUTOFILL_EXECUTION);
    const autofillText = autofillStage
      ? `Autofill completed in only ${autofillStage.durationMs}ms.`
      : 'Form autofill was ready.';

    if (outcome === 'SUCCESS') {
      return `🎉 Booking attempt completed in ${durationSec}s. ${autofillText} The primary time consumer was ${bottleneck.stageName} (${(bottleneck.durationMs / 1000).toFixed(1)}s, ${bottleneck.impactPercentage}% of total). ${bottleneck.recommendation}`;
    }

    return `⚠️ Booking attempt finished with status: ${outcome.replace('FAILURE_', '').replace(/_/g, ' ')} after ${durationSec}s. ${autofillText} Diagnosis: ${bottleneck.explanation} Advice: ${bottleneck.recommendation}`;
  }
}

