/**
 * Shared Type Definitions & Contracts for IRCTC Tatkal Transparency Layer
 */

// ==========================================
// 1. Passenger Profile & Zero-Knowledge Vault
// ==========================================

export type Gender = 'M' | 'F' | 'T';

export type BerthPreference = 'NO_PREFERENCE' | 'LOWER' | 'MIDDLE' | 'UPPER' | 'SIDE_LOWER' | 'SIDE_UPPER' | 'CABIN' | 'COUPE';

export type FoodPreference = 'V' | 'N' | 'D'; // Veg, Non-Veg, Don't specify

export interface Passenger {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  berthPreference: BerthPreference;
  foodPreference?: FoodPreference;
  seniorCitizen?: boolean;
  nationality?: string;
  idCardType?: string;
  idCardNumber?: string;
}

export interface TravelPreferences {
  autoUpgrade: boolean;
  bookOnlyIfConfirmed: boolean;
  preferCoachId?: string;
  mobileNumber: string;
  gstin?: string;
  travelInsuranceOptIn: boolean;
  paymentMethodPreference: 'UPI' | 'NET_BANKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'WALLET';
}

export interface PassengerVaultData {
  version: number;
  profileName: string;
  passengers: Passenger[];
  preferences: TravelPreferences;
  createdAt: number;
  updatedAt: number;
}

/**
 * Server-side stored ciphertext blob.
 * Server never receives decryption keys or plaintext passenger details.
 */
export interface EncryptedVaultBlob {
  id: string;
  userId: string;
  profileName: string;
  ciphertext: string; // Base64 encoded AES-GCM ciphertext + auth tag
  iv: string;         // Base64 encoded 12-byte IV
  salt: string;       // Base64 encoded salt used for PBKDF2 key derivation
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 2. Tokenized Payment References (PCI-Compliant)
// ==========================================

export interface PaymentTokenRef {
  id: string;
  userId: string;
  provider: 'RAZORPAY_SANDBOX' | 'STRIPE_TEST' | 'MOCK_TOKENIZER';
  tokenRef: string; // Opaque provider token identifier (e.g. tok_1N...)
  cardLast4?: string;
  cardNetwork?: 'VISA' | 'MASTERCARD' | 'RUPAY' | 'AMEX';
  upiHandleMasked?: string;
  label: string;
  createdAt: string;
}

// ==========================================
// 3. Timing Diagnostics & Stage Transitions
// ==========================================

export enum StageType {
  PAGE_LOAD = 'PAGE_LOAD',
  TRAIN_SEARCH = 'TRAIN_SEARCH',
  SEAT_AVAILABILITY_CHECK = 'SEAT_AVAILABILITY_CHECK',
  PASSENGER_FORM_OPEN = 'PASSENGER_FORM_OPEN',
  AUTOFILL_EXECUTION = 'AUTOFILL_EXECUTION',
  CAPTCHA_DISPLAYED = 'CAPTCHA_DISPLAYED',
  FORM_SUBMISSION = 'FORM_SUBMISSION',
  REVIEW_PAGE_LOAD = 'REVIEW_PAGE_LOAD',
  PAYMENT_REDIRECT = 'PAYMENT_REDIRECT',
  PAYMENT_GATEWAY_INTERACTION = 'PAYMENT_GATEWAY_INTERACTION',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  BOOKING_CONFIRMATION = 'BOOKING_CONFIRMATION',
  BOOKING_FAILURE = 'BOOKING_FAILURE'
}

export interface StageTimestamp {
  stage: StageType;
  startTime: number; // performance.now() or Epoch ms
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface StageSummary {
  stage: StageType;
  stageName: string;
  durationMs: number;
  percentOfTotal: number;
  status: 'optimal' | 'moderate' | 'bottleneck';
  description: string;
}

export interface BottleneckAnalysis {
  stage: StageType;
  stageName: string;
  durationMs: number;
  category: 'NETWORK_SERVER' | 'USER_INTERACTION' | 'GATEWAY_PROCESSING' | 'CAPTCHA_FRICTION';
  impactPercentage: number;
  explanation: string;
  recommendation: string;
}

export interface DiagnosticReport {
  sessionId: string;
  trainNumber?: string;
  trainName?: string;
  quota?: 'TATKAL' | 'PREMIUM_TATKAL' | 'GENERAL' | 'LADIES';
  classType?: '1A' | '2A' | '3A' | '3E' | 'SL' | 'CC' | 'EC';
  startTimeIso: string;
  totalDurationMs: number;
  outcome: 'SUCCESS' | 'FAILURE_SEATS_EXHAUSTED' | 'FAILURE_TIMEOUT' | 'FAILURE_PAYMENT' | 'FAILURE_CAPTCHA' | 'ABORTED_BY_USER';
  stages: StageSummary[];
  bottleneck: BottleneckAnalysis;
  plainLanguageSummary: string;
  isTatkalPeakWindow: boolean; // True if conducted between 09:59:30 - 10:05:00 or 10:59:30 - 11:05:00 IST
  createdAt: string;
}

// ==========================================
// 4. Anonymized Telemetry & Analytics Ingestion
// ==========================================

export interface AnonymizedStageMetric {
  stage: StageType;
  durationMs: number;
}

export interface AnonymizedTelemetryPayload {
  sessionHash: string; // One-way SHA-256 hash of (sessionId + dailySalt)
  tatkalQuota: 'AC_TATKAL' | 'NON_AC_TATKAL' | 'GENERAL';
  totalDurationMs: number;
  stages: AnonymizedStageMetric[];
  outcome: 'SUCCESS' | 'FAILURE_SEATS_EXHAUSTED' | 'FAILURE_TIMEOUT' | 'FAILURE_PAYMENT' | 'FAILURE_CAPTCHA' | 'ABORTED';
  primaryBottleneckStage: StageType;
  clientVersion: string;
  timestamp: string; // ISO String
}

export interface DashboardSummary {
  totalAttemptsTracked: number;
  averageBookingDurationMs: number;
  successRatePercentage: number;
  bottleneckBreakdown: {
    stage: StageType;
    stageName: string;
    percentage: number;
    avgDurationMs: number;
    count: number;
  }[];
  failureCauseBreakdown: {
    cause: string;
    percentage: number;
    count: number;
  }[];
  hourlyTrend: {
    hour: string; // "09:55", "10:00", "10:05", etc.
    avgServerLatencyMs: number;
    avgUserFillMs: number;
    avgPaymentMs: number;
    successRate: number;
  }[];
  recentAggregatedSessions: {
    id: string;
    timeAgo: string;
    durationSec: number;
    outcome: string;
    bottleneck: string;
    quota: string;
  }[];
  lastUpdated: string;
}

// ==========================================
// 5. API Response Contracts
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
}

export interface ReadinessCheckResult {
  isReady: boolean;
  checks: {
    vaultDecrypted: boolean;
    passengerCount: number;
    paymentTokenConfigured: boolean;
    networkLatencyMs: number;
    irctcDomainReachable: boolean;
    clockSkewMs: number;
  };
  tatkalWindow: {
    type: 'AC' | 'NON_AC' | 'NONE';
    secondsRemaining: number;
    targetTime: string;
    isWindowActive: boolean;
  };
  warnings: string[];
}

