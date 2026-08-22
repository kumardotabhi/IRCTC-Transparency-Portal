import React, { useState, useEffect } from 'react';
import { PassengerVaultData, DiagnosticReport, StageType, StageSummary } from '@irctc-tatkal/shared';
import { FormDetectionResult } from '../modules/forms/form-detector';
import { autofillEngine, AutofillResult } from '../modules/autofill/autofill';
import { TimingLogger } from '../modules/timing/timing-logger';

export interface OverlayProps {
  detection: FormDetectionResult;
  timingLogger: TimingLogger;
  vaultData: PassengerVaultData | null;
  onAutofillTriggered: () => void;
}

export function Overlay({ detection, timingLogger, vaultData, onAutofillTriggered }: OverlayProps) {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [autofillStatus, setAutofillStatus] = useState<AutofillResult | null>(null);
  const [activeReport, setActiveReport] = useState<DiagnosticReport | null>(null);

  // Live stopwatch during active booking flow
  useEffect(() => {
    const timer = setInterval(() => {
      const timestamps = timingLogger.getTimestamps();
      if (timestamps.length > 0) {
        const start = timestamps[0].startTime;
        const now = performance.now();
        setElapsedMs(Math.round(now - start));
      }
    }, 100);

    return () => clearInterval(timer);
  }, [timingLogger]);

  // Handle 1-click autofill
  const handleAutofill = () => {
    if (!vaultData || !vaultData.passengers || vaultData.passengers.length === 0) {
      alert('Passenger Vault is empty! Open Extension Options to add passengers.');
      return;
    }

    timingLogger.startStage(StageType.AUTOFILL_EXECUTION);
    const result = autofillEngine.fillPassengerDetails(vaultData, document);
    timingLogger.endCurrentStage();
    setAutofillStatus(result);
    onAutofillTriggered();

    setTimeout(() => {
      setAutofillStatus(null);
    }, 3500);
  };

  const handleGenerateReport = (outcome: DiagnosticReport['outcome'] = 'SUCCESS') => {
    const report = timingLogger.generateReport(outcome);
    setActiveReport(report);

    // Save report to storage
    chrome.runtime.sendMessage({
      type: 'SAVE_DIAGNOSTIC_REPORT',
      payload: { report }
    });

    // Send opt-in telemetry
    chrome.runtime.sendMessage({
      type: 'DISPATCH_TELEMETRY',
      payload: { report }
    });
  };

  const formatScreenName = (screen: string) => {
    return screen.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <>
      {/* Floating HUD Badge / Panel */}
      <div className="fixed top-4 right-4 z-[999999] font-sans antialiased select-none text-slate-100">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl shadow-black/60 p-3 w-80 transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
              <span className="text-xs font-bold tracking-tight text-white">Tatkal Diagnostics HUD</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-orange-400 bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-800/40">
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="text-slate-400 hover:text-slate-200 text-xs px-1"
              >
                {collapsed ? '▼' : '▲'}
              </button>
            </div>
          </div>

          {!collapsed && (
            <div className="space-y-2.5 text-xs">
              {/* Screen Indicator */}
              <div className="flex items-center justify-between bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400">Current Screen:</span>
                <span className="font-semibold text-orange-300">
                  {formatScreenName(detection.activeScreen)}
                </span>
              </div>

              {/* Passenger Autofill CTA when on passenger screen */}
              {detection.activeScreen === 'PASSENGER_DETAILS' && (
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={handleAutofill}
                    className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2"
                  >
                    <span>⚡ 1-Click Vault Autofill ({vaultData?.passengers?.length || 0} Psgn)</span>
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">
                    Fills fields natively • No auto-submit (Human control)
                  </p>
                </div>
              )}

              {/* Autofill Toast */}
              {autofillStatus && (
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800 text-[11px] text-emerald-200">
                  ✅ Successfully pre-filled {autofillStatus.filledPassengersCount} passenger(s) in {autofillStatus.durationMs}ms!
                </div>
              )}

              {/* Manual mode notification if selectors fail */}
              {detection.manualFallbackMode && (
                <div className="p-2 rounded bg-amber-950/50 border border-amber-800/60 text-[10px] text-amber-300">
                  ⚠️ Unrecognized DOM schema. Falling back to passive latency timer.
                </div>
              )}

              {/* Live Stage List */}
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 font-medium">Session Stages:</div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px]">
                  {timingLogger.getTimestamps().map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-300 bg-slate-950/40 px-2 py-0.5 rounded">
                      <span className="truncate">{t.stage.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-slate-400 text-[10px]">
                        {t.durationMs ? `${t.durationMs}ms` : 'active...'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trigger Report Button */}
              <div className="pt-2 border-t border-slate-800 flex space-x-1.5">
                <button
                  onClick={() => handleGenerateReport('SUCCESS')}
                  className="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition border border-slate-700"
                >
                  📊 Finish & Generate Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DIAGNOSTIC REPORT MODAL */}
      {activeReport && (
        <div className="fixed inset-0 z-[9999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-lg font-bold text-white shadow-lg">
                  📊
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Tatkal Booking Attempt Diagnosis</h2>
                  <p className="text-xs text-slate-400">
                    Session: <span className="font-mono text-slate-300">{activeReport.sessionId}</span> • Total Duration: <span className="text-orange-400 font-bold">{(activeReport.totalDurationMs / 1000).toFixed(1)}s</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveReport(null)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Plain Language Diagnosis Hero */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                Plain-Language Diagnostic Summary
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {activeReport.plainLanguageSummary}
              </p>
            </div>

            {/* Bottleneck Callout */}
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-start space-x-3 text-xs text-amber-200">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="font-bold text-amber-300">
                  Primary Bottleneck: {activeReport.bottleneck.stageName} ({(activeReport.bottleneck.durationMs / 1000).toFixed(1)}s, {activeReport.bottleneck.impactPercentage}% of total)
                </div>
                <div className="text-[11px] text-amber-200/80 mt-0.5">
                  {activeReport.bottleneck.explanation}
                </div>
                <div className="text-[11px] text-amber-300 font-semibold mt-1">
                  💡 Pro-tip: {activeReport.bottleneck.recommendation}
                </div>
              </div>
            </div>

            {/* Gantt / Horizontal Bar Stage Breakdown */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300">Stage-by-Stage Latency Breakdown (Gantt View)</div>
              <div className="space-y-2">
                {activeReport.stages.map((stg, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">{stg.stageName}</span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        {stg.durationMs}ms ({stg.percentOfTotal}%)
                      </span>
                    </div>
                    {/* Horizontal Bar */}
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          stg.status === 'bottleneck'
                            ? 'bg-rose-500'
                            : stg.status === 'moderate'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(4, stg.percentOfTotal)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400">
                🔒 Anonymized telemetry sent to Transparency Dashboard
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.open('http://localhost:3000/dashboard', '_blank')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                >
                  View Public Dashboard
                </button>
                <button
                  onClick={() => setActiveReport(null)}
                  className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

