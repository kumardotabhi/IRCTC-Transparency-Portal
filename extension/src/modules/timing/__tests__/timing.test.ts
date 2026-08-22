import { TimingLogger } from '../timing-logger';
import { StageType } from '@irctc-tatkal/shared';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTimingTests() {
  console.log('🧪 Starting Timing Diagnostics Unit Tests...');

  const logger = new TimingLogger({
    quota: 'TATKAL',
    trainNumber: '12658'
  });

  // Test 1: Stage Transitions & Durations
  logger.startStage(StageType.PAGE_LOAD);
  await sleep(60);

  logger.startStage(StageType.SEAT_AVAILABILITY_CHECK);
  await sleep(150);

  logger.startStage(StageType.AUTOFILL_EXECUTION);
  await sleep(20);

  logger.startStage(StageType.CAPTCHA_DISPLAYED);
  await sleep(80);

  logger.startStage(StageType.PAYMENT_GATEWAY_INTERACTION);
  await sleep(120);

  const report = logger.generateReport('SUCCESS');

  if (!report.sessionId || !report.stages || report.stages.length !== 5) {
    throw new Error(`Expected 5 recorded stages, got: ${report.stages.length}`);
  }

  console.log(`  ✅ [PASS] Recorded ${report.stages.length} sequential timing stages`);
  console.log(`  ✅ [PASS] Total session duration: ${report.totalDurationMs}ms`);

  // Test 2: Bottleneck Identification
  if (report.bottleneck && report.bottleneck.stage === StageType.SEAT_AVAILABILITY_CHECK) {
    console.log(`  ✅ [PASS] Primary bottleneck correctly identified as ${report.bottleneck.stageName}`);
  } else {
    throw new Error(`Bottleneck identification incorrect: ${JSON.stringify(report.bottleneck)}`);
  }

  // Test 3: Plain Language Summary Generation
  if (report.plainLanguageSummary && report.plainLanguageSummary.includes('Booking attempt completed')) {
    console.log('  ✅ [PASS] Plain language diagnostic explanation generated');
  } else {
    throw new Error('Plain language summary missing expected explanation.');
  }

  console.log('✨ All Timing Diagnostics Tests Passed Successfully!\n');
}

runTimingTests().catch((err) => {
  console.error('❌ Timing Diagnostics Tests Failed:', err);
  process.exit(1);
});

