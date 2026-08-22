import React from 'react';
import ReactDOM from 'react-dom/client';
import { formDetector, FormDetectionResult, ScreenType } from '../modules/forms/form-detector';
import { TimingLogger } from '../modules/timing/timing-logger';
import { StageType, PassengerVaultData } from '@irctc-tatkal/shared';
import { Overlay } from './Overlay';
import '../styles/index.css';

console.log('[Tatkal Content Script] Loaded and monitoring DOM.');

const timingLogger = new TimingLogger({
  quota: 'TATKAL'
});

// Start initial PAGE_LOAD stage
timingLogger.startStage(StageType.PAGE_LOAD);

// Container for Shadow/Isolated DOM
const containerId = 'irctc-tatkal-extension-root';
let container = document.getElementById(containerId);
if (!container) {
  container = document.createElement('div');
  container.id = containerId;
  document.body.appendChild(container);
}

let activeVaultData: PassengerVaultData | null = null;
let currentScreen: ScreenType = 'UNKNOWN';

// Query background worker for decrypted vault data
function fetchVaultData() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_ACTIVE_VAULT_DATA' }, (response) => {
      if (response && response.vaultData) {
        activeVaultData = response.vaultData;
        renderOverlay();
      }
    });
  } catch (err) {
    console.log('[Tatkal Layer] Direct runtime context unavailable (local script mode).');
  }
}

fetchVaultData();

function renderOverlay() {
  if (!container) return;
  const detection: FormDetectionResult = formDetector.detectScreen(document);

  // Check if screen changed to advance timing logger stage
  if (detection.activeScreen !== currentScreen) {
    currentScreen = detection.activeScreen;
    if (currentScreen === 'TRAIN_SEARCH') {
      timingLogger.startStage(StageType.TRAIN_SEARCH);
    } else if (currentScreen === 'PASSENGER_DETAILS') {
      timingLogger.startStage(StageType.PASSENGER_FORM_OPEN);
    } else if (currentScreen === 'REVIEW_AND_CAPTCHA') {
      timingLogger.startStage(StageType.CAPTCHA_DISPLAYED);
    } else if (currentScreen === 'PAYMENT_GATEWAY') {
      timingLogger.startStage(StageType.PAYMENT_GATEWAY_INTERACTION);
    } else if (currentScreen === 'CONFIRMATION') {
      timingLogger.startStage(StageType.BOOKING_CONFIRMATION);
    }
  }

  const root = ReactDOM.createRoot(container);
  root.render(
    <Overlay
      detection={detection}
      timingLogger={timingLogger}
      vaultData={activeVaultData}
      onAutofillTriggered={() => {
        fetchVaultData();
      }}
    />
  );
}

// Initial render
window.addEventListener('load', () => {
  timingLogger.endCurrentStage();
  renderOverlay();
});

// Re-evaluate on DOM mutations (screen navigation in SPA)
const observer = new MutationObserver(() => {
  const detection = formDetector.detectScreen(document);
  if (detection.activeScreen !== currentScreen) {
    renderOverlay();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

renderOverlay();

