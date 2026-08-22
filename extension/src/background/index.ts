/**
 * Background Service Worker
 * Manifest V3 background coordinator
 */

import { PassengerVaultData, DiagnosticReport } from '@irctc-tatkal/shared';
import { TelemetryDispatcher } from '../modules/telemetry/telemetry';

console.log('[Tatkal Layer SW] Service Worker Initialized.');

// Listen for messages from Content Script and Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_ACTIVE_VAULT_DATA') {
    chrome.storage.local.get(['activeDecryptedVault', 'masterKeyUnlocked', 'userSettings'], (res) => {
      sendResponse({
        vaultData: res.activeDecryptedVault || null,
        isUnlocked: !!res.masterKeyUnlocked,
        settings: res.userSettings || { telemetryOptIn: true, localOnlyMode: false }
      });
    });
    return true; // async sendResponse
  }

  if (message.type === 'SAVE_ACTIVE_VAULT_DATA') {
    chrome.storage.local.set({
      activeDecryptedVault: message.payload.vaultData,
      masterKeyUnlocked: true
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'DISPATCH_TELEMETRY') {
    const report: DiagnosticReport = message.payload.report;
    chrome.storage.local.get(['userSettings'], async (res) => {
      const settings = res.userSettings || { telemetryOptIn: true };
      const dispatcher = new TelemetryDispatcher({
        isOptedIn: !!settings.telemetryOptIn
      });
      const success = await dispatcher.sendReportTelemetry(report);
      sendResponse({ success });
    });
    return true;
  }

  if (message.type === 'SAVE_DIAGNOSTIC_REPORT') {
    const report: DiagnosticReport = message.payload.report;
    chrome.storage.local.get(['pastReports'], (res) => {
      const pastReports = res.pastReports || [];
      pastReports.unshift(report);
      // Keep latest 20 reports
      chrome.storage.local.set({ pastReports: pastReports.slice(0, 20) }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

