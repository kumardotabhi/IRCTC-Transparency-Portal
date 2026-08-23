import React from 'react';
import ReactDOM from 'react-dom/client';
import { formDetector, FormDetectionResult, ScreenType } from '../modules/forms/form-detector';
import { TimingLogger } from '../modules/timing/timing-logger';
import { StageType, PassengerVaultData } from '@irctc-tatkal/shared';
import { Overlay } from './Overlay';
import '../styles/index.css';

console.log('[Tatkal Content Script] Loaded and monitoring DOM.');

const timingLogger = new TimingLogger({ quota: 'TATKAL' });
timingLogger.startStage(StageType.PAGE_LOAD);

// ── Create overlay container once ────────────────────────────────────────────
// We use a fixed container with a shadow root so our styles don't leak.
const containerId = 'irctc-tatkal-extension-root';

function ensureContainer(): HTMLElement {
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    // Ensure the overlay always sits on top
    el.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;';
    // Use document.documentElement as fallback if body isn't ready yet
    (document.body || document.documentElement).appendChild(el);
  }
  return el;
}

// Single React root instance — never recreate it
let reactRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;

let activeVaultData: PassengerVaultData | null = null;
let currentScreen: ScreenType = 'UNKNOWN';

// ── Render helpers ────────────────────────────────────────────────────────────
function renderOverlay(detection: FormDetectionResult) {
  try {
    const container = ensureContainer();
    if (!reactRoot) {
      reactRoot = ReactDOM.createRoot(container);
    }
    reactRoot.render(
      <Overlay
        detection={detection}
        timingLogger={timingLogger}
        vaultData={activeVaultData}
        onAutofillTriggered={() => fetchVaultData()}
      />
    );
  } catch (err) {
    console.warn('[Tatkal Layer] Overlay render error:', err);
  }
}

function detectAndRender() {
  const detection: FormDetectionResult = formDetector.detectScreen(document);

  // Advance timing stages when the screen changes
  if (detection.activeScreen !== currentScreen) {
    timingLogger.endCurrentStage();
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

  renderOverlay(detection);
}

// ── Vault data fetcher ────────────────────────────────────────────────────────
function fetchVaultData() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_ACTIVE_VAULT_DATA' }, (response) => {
      if (chrome.runtime.lastError) {
        // Keep the HUD available even when the background worker is unavailable.
        detectAndRender();
        return;
      }
      if (response && response.vaultData) {
        activeVaultData = response.vaultData;
      }
      detectAndRender();
    });
  } catch (err) {
    // Fallback: render without vault data
    detectAndRender();
    console.log('[Tatkal Layer] Runtime unavailable, rendering in standalone mode.');
  }
}

// ── Initial render ────────────────────────────────────────────────────────────
// Run as soon as possible — the body may already exist (DOMContentLoaded fires
// before this script for document_idle injection).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    timingLogger.endCurrentStage(); // end PAGE_LOAD
    fetchVaultData();
  });
} else {
  // DOM is already ready
  timingLogger.endCurrentStage(); // end PAGE_LOAD
  fetchVaultData();
}

// ── SPA mutation observer ─────────────────────────────────────────────────────
// Re-evaluate on DOM mutations so the HUD updates as the user navigates screens.
// IMPORTANT: debounce is critical — without it, the observer fires on every
// React render (including its own div insertion), creating an infinite loop
// that starves setTimeout and breaks the mock portal's loading overlay.
let observerDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const observer = new MutationObserver(() => {
  // Skip mutations that only affect our own overlay container
  if (observerDebounceTimer) clearTimeout(observerDebounceTimer);
  observerDebounceTimer = setTimeout(() => {
    const detection = formDetector.detectScreen(document);
    if (detection.activeScreen !== currentScreen) {
      detectAndRender();
    }
  }, 200); // 200ms debounce — imperceptible to user, prevents busy-loop
});

// Start observing once the body exists
function startObserver() {
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class']
        });
      }
    });
  }
}

startObserver();
