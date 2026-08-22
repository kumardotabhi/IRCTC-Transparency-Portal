import { analyticsStore } from '../database/eventStore';
import { EventsController } from '../events/eventsController';
import { DashboardController } from '../dashboard/dashboardController';
import { StageType } from '@irctc-tatkal/shared';

function createMockReqRes(body: any = {}) {
  let statusCode = 200;
  let responseData: any = null;

  const req: any = { body, headers: {} };
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData
  };

  return { req, res };
}

async function runAnalyticsTests() {
  console.log('🧪 Starting Analytics Ingest Service Unit Tests...');
  analyticsStore.clear();

  // Test 1: Ingest Valid Anonymized Batch
  {
    const validBatch = [
      {
        sessionHash: 'anon_sha256_hash_test_12345',
        tatkalQuota: 'AC_TATKAL',
        totalDurationMs: 14200,
        stages: [
          { stage: StageType.PAGE_LOAD, durationMs: 1200 },
          { stage: StageType.SEAT_AVAILABILITY_CHECK, durationMs: 4500 },
          { stage: StageType.AUTOFILL_EXECUTION, durationMs: 250 },
          { stage: StageType.CAPTCHA_DISPLAYED, durationMs: 5100 },
          { stage: StageType.PAYMENT_GATEWAY_INTERACTION, durationMs: 3150 }
        ],
        outcome: 'SUCCESS',
        primaryBottleneckStage: StageType.CAPTCHA_DISPLAYED,
        clientVersion: '1.0.0',
        timestamp: new Date().toISOString()
      },
      {
        sessionHash: 'anon_sha256_hash_test_67890',
        tatkalQuota: 'NON_AC_TATKAL',
        totalDurationMs: 18500,
        stages: [
          { stage: StageType.PAGE_LOAD, durationMs: 2500 },
          { stage: StageType.SEAT_AVAILABILITY_CHECK, durationMs: 8900 },
          { stage: StageType.AUTOFILL_EXECUTION, durationMs: 300 }
        ],
        outcome: 'FAILURE_SEATS_EXHAUSTED',
        primaryBottleneckStage: StageType.SEAT_AVAILABILITY_CHECK,
        clientVersion: '1.0.0',
        timestamp: new Date().toISOString()
      }
    ];

    const { req, res } = createMockReqRes(validBatch);
    await EventsController.ingestBatch(req, res);
    const data = res.getResponseData();

    if (res.getStatusCode() === 202 && data.success && data.ingestedCount === 2) {
      console.log('  ✅ [PASS] Valid anonymized telemetry batch ingested');
    } else {
      throw new Error(`Valid batch ingestion failed: ${JSON.stringify(data)}`);
    }
  }

  // Test 2: PII Rejection (Strict Privacy Guardrail)
  {
    const piiPayload = {
      sessionHash: 'anon_with_pii_leak',
      name: 'Ramesh Kumar', // PII Violation!
      email: 'ramesh@example.com',
      totalDurationMs: 12000,
      stages: [{ stage: StageType.PAGE_LOAD, durationMs: 1200 }],
      outcome: 'SUCCESS'
    };

    const { req, res } = createMockReqRes(piiPayload);
    await EventsController.ingestBatch(req, res);
    const data = res.getResponseData();

    if (res.getStatusCode() === 400 && data.success === false && data.error.includes('Privacy Violation')) {
      console.log('  ✅ [PASS] Telemetry payload containing PII strictly rejected');
    } else {
      throw new Error(`Privacy filter failed to reject PII: ${JSON.stringify(data)}`);
    }
  }

  // Test 3: Malformed Payload Rejection
  {
    const malformedPayload = {
      tatkalQuota: 'AC_TATKAL' // Missing sessionHash, totalDurationMs, etc.
    };

    const { req, res } = createMockReqRes(malformedPayload);
    await EventsController.ingestBatch(req, res);
    const data = res.getResponseData();

    if (res.getStatusCode() === 400 && data.success === false) {
      console.log('  ✅ [PASS] Malformed telemetry payload rejected');
    } else {
      throw new Error(`Malformed payload was not rejected: ${JSON.stringify(data)}`);
    }
  }

  // Test 4: Dashboard Summary Aggregation
  {
    const { req, res } = createMockReqRes({});
    await DashboardController.getSummary(req, res);
    const data = res.getResponseData();

    if (
      res.getStatusCode() === 200 &&
      data.success &&
      data.data.totalAttemptsTracked === 2 &&
      data.data.successRatePercentage === 50 &&
      Array.isArray(data.data.bottleneckBreakdown)
    ) {
      console.log('  ✅ [PASS] Dashboard summary computes accurate aggregate statistics');
    } else {
      throw new Error(`Dashboard summary verification failed: ${JSON.stringify(data)}`);
    }
  }

  console.log('✨ All Analytics Ingest Service Unit Tests Passed Successfully!\n');
}

runAnalyticsTests().catch((err) => {
  console.error('❌ Analytics Service Tests Failed:', err);
  process.exit(1);
});

