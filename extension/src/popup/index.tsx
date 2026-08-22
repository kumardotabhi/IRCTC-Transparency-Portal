import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { runReadinessCheck } from '../modules/readiness/readiness-check';
import { ReadinessCheckResult, PassengerVaultData } from '@irctc-tatkal/shared';

export function PopupApp() {
  const [readiness, setReadiness] = useState<ReadinessCheckResult | null>(null);
  const [vaultData, setVaultData] = useState<PassengerVaultData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<string>('00:00:00');

  const loadData = () => {
    setLoading(true);
    chrome.storage.local.get(['activeDecryptedVault', 'paymentTokens', 'userSettings'], async (res) => {
      const activeVault = res.activeDecryptedVault || null;
      const hasPayment = Array.isArray(res.paymentTokens) && res.paymentTokens.length > 0;
      setVaultData(activeVault);

      const check = await runReadinessCheck({
        vaultData: activeVault,
        hasPaymentToken: hasPayment,
        vaultApiUrl: 'http://localhost:3001'
      });

      setReadiness(check);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();

    // 1-second countdown ticker
    const timer = setInterval(() => {
      const now = new Date();
      // Target next 10:00 AM or 11:00 AM IST
      const target = new Date(now);
      if (now.getHours() < 10) {
        target.setHours(10, 0, 0, 0);
      } else if (now.getHours() === 10 && now.getMinutes() < 60) {
        target.setHours(11, 0, 0, 0);
      } else {
        target.setDate(target.getDate() + 1);
        target.setHours(10, 0, 0, 0);
      }

      const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
      const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const secs = String(diffSec % 60).padStart(2, '0');
      setCountdown(`${hrs}:${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const openOptions = (tab?: string) => {
    chrome.runtime.openOptionsPage();
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
  };

  const openMockIrctc = () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-white shadow-md shadow-orange-950/40">
            ⚡
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">Tatkal Readiness Layer</h1>
            <p className="text-[10px] text-slate-400">IRCTC Transparency & Fast Autofill</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-mono font-medium">
          v1.0.0
        </span>
      </div>

      {/* Countdown Hero */}
      <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-800/60 p-3.5 border border-slate-700/60 mb-3 shadow-inner">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            {readiness?.tatkalWindow?.type === 'NON_AC' ? 'Non-AC Tatkal (11:00 AM)' : 'AC Tatkal (10:00 AM)'}
          </span>
          <span className="text-[10px] font-mono text-orange-400 bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-800/60">
            IST
          </span>
        </div>
        <div className="flex items-baseline justify-center my-1 space-x-1 font-mono">
          <span className="text-3xl font-extrabold text-white tracking-wider">{countdown}</span>
          <span className="text-xs text-slate-400 font-normal">remaining</span>
        </div>
        <p className="text-center text-[10px] text-slate-400">
          Target opening window: <span className="text-slate-200 font-semibold">{readiness?.tatkalWindow?.targetTime || '10:00:00 AM'}</span>
        </p>
      </div>

      {/* Readiness Status Checklist */}
      <div className="flex-1 space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>Readiness Checklist</span>
          {readiness?.isReady ? (
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> READY FOR TATKAL
            </span>
          ) : (
            <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> ACTION NEEDED
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Vault Status */}
          <div className={`p-2 rounded-lg border flex flex-col justify-between ${
            readiness?.checks.vaultDecrypted && readiness?.checks.passengerCount > 0
              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
              : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
          }`}>
            <span className="text-[10px] text-slate-400">Passenger Vault</span>
            <span className="font-semibold truncate">
              {readiness?.checks.vaultDecrypted && readiness.checks.passengerCount > 0
                ? `✅ ${readiness.checks.passengerCount} Passenger(s)`
                : '⚠️ Locked / Empty'}
            </span>
          </div>

          {/* Payment Token */}
          <div className={`p-2 rounded-lg border flex flex-col justify-between ${
            readiness?.checks.paymentTokenConfigured
              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
              : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
          }`}>
            <span className="text-[10px] text-slate-400">Payment Token</span>
            <span className="font-semibold truncate">
              {readiness?.checks.paymentTokenConfigured ? '✅ Token Ready' : '⚠️ Not Linked'}
            </span>
          </div>

          {/* API Latency */}
          <div className="p-2 rounded-lg border bg-slate-800/40 border-slate-700/60 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400">API Health Latency</span>
            <span className="font-semibold text-slate-200 font-mono">
              {readiness?.checks.networkLatencyMs !== undefined && readiness.checks.networkLatencyMs < 999
                ? `⚡ ${readiness.checks.networkLatencyMs}ms`
                : '❌ Offline'}
            </span>
          </div>

          {/* Clock Skew */}
          <div className="p-2 rounded-lg border bg-slate-800/40 border-slate-700/60 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400">Clock Skew (NTP)</span>
            <span className="font-semibold text-slate-200 font-mono">
              {readiness?.checks.clockSkewMs !== undefined
                ? `${readiness.checks.clockSkewMs > 0 ? '+' : ''}${readiness.checks.clockSkewMs}ms`
                : '0ms'}
            </span>
          </div>
        </div>

        {/* Warnings List if any */}
        {readiness?.warnings && readiness.warnings.length > 0 && (
          <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-300 space-y-1">
            {readiness.warnings.slice(0, 2).map((w, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">•</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1 border-t border-slate-800">
        <button
          onClick={() => openOptions()}
          className="w-full py-2 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition shadow-md shadow-orange-950/40 flex items-center justify-center gap-2"
        >
          <span>🔒 Manage Passenger Vault</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={openMockIrctc}
            className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <span>🚂 Open Mock IRCTC</span>
          </button>
          <button
            onClick={openDashboard}
            className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <span>📊 Public Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<PopupApp />);
}

