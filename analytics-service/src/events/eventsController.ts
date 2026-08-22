import { Request, Response } from 'express';
import { AnonymizedTelemetryPayload, StageType } from '@irctc-tatkal/shared';
import { analyticsStore } from '../database/eventStore';

const PII_FORBIDDEN_KEYS = [
  'name', 'passenger', 'email', 'phone', 'mobile', 'password',
  'cardNumber', 'card', 'cvv', 'cvc', 'pin', 'token', 'user', 'userId',
  'irctcPassword', 'irctcUsername', 'dob', 'address', 'pnr'
];

function containsPii(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (PII_FORBIDDEN_KEYS.some((forbidden) => lowerKey.includes(forbidden))) {
      return true;
    }
    if (typeof obj[key] === 'object' && containsPii(obj[key])) {
      return true;
    }
  }
  return false;
}

function isValidTelemetryPayload(payload: any): payload is AnonymizedTelemetryPayload {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.sessionHash !== 'string' || !payload.sessionHash.trim()) return false;
  if (typeof payload.totalDurationMs !== 'number' || payload.totalDurationMs <= 0) return false;
  if (!Array.isArray(payload.stages)) return false;
  if (!payload.outcome || typeof payload.outcome !== 'string') return false;
  return true;
}

export class EventsController {
  /**
   * Ingest a batch of anonymized diagnostic events.
   * STRICT PRIVACY FILTER: Rejects any batch containing PII fields.
   */
  static async ingestBatch(req: Request, res: Response) {
    try {
      const body = req.body;

      // 1. Check for PII presence
      if (containsPii(body)) {
        return res.status(400).json({
          success: false,
          error: 'Privacy Violation: Ingested payload contains forbidden personal identifiers. Telemetry must be strictly anonymized.'
        });
      }

      // 2. Extract events (support single event object or array)
      const events: any[] = Array.isArray(body)
        ? body
        : Array.isArray(body.events)
        ? body.events
        : [body];

      if (events.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Payload cannot be empty.'
        });
      }

      // 3. Validate each payload
      const validPayloads: AnonymizedTelemetryPayload[] = [];
      for (const item of events) {
        if (!isValidTelemetryPayload(item)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid telemetry structure. Missing sessionHash, totalDurationMs, or stages array.'
          });
        }
        validPayloads.push(item);
      }

      // 4. Save to store
      analyticsStore.addEventsBatch(validPayloads);

      return res.status(202).json({
        success: true,
        message: `Successfully ingested ${validPayloads.length} anonymized diagnostic record(s).`,
        ingestedCount: validPayloads.length
      });
    } catch (err: any) {
      console.error('[Events.ingestBatch] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error while processing telemetry batch.'
      });
    }
  }
}

