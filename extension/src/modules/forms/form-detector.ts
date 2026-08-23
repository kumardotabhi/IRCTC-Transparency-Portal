/**
 * DOM Form Detector Module
 * Version-gated screen identifier with safe fallback
 */

import { SELECTORS_V1, SelectorSchema } from './selectors/v1';

export type ScreenType =
  | 'TRAIN_SEARCH'
  | 'PASSENGER_DETAILS'
  | 'REVIEW_AND_CAPTCHA'
  | 'PAYMENT_GATEWAY'
  | 'CONFIRMATION'
  | 'UNKNOWN';

export interface FormDetectionResult {
  activeScreen: ScreenType;
  schemaVersion: string;
  isSupported: boolean;
  manualFallbackMode: boolean;
  detectedElements: {
    hasPassengerRows: boolean;
    hasCaptcha: boolean;
    hasPaymentOptions: boolean;
  };
}

export class FormDetector {
  private schema: SelectorSchema;

  constructor(customSchema?: SelectorSchema) {
    this.schema = customSchema || SELECTORS_V1;
  }

  /**
   * Safe query selector helper
   */
  private query(selector: string, root: Document | Element = document): Element | null {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  }

  /**
   * Safe query selector all helper
   */
  private queryAll(selector: string, root: Document | Element = document): Element[] {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  private isVisible(element: Element): boolean {
    const htmlElement = element as HTMLElement;
    if (htmlElement.closest('.hidden')) return false;
    if (typeof window === 'undefined') return true;
    const styles = window.getComputedStyle(htmlElement);
    return styles.display !== 'none' && styles.visibility !== 'hidden';
  }

  private queryVisible(selector: string, root: Document | Element = document): Element | null {
    return this.queryAll(selector, root).find((element) => this.isVisible(element)) || null;
  }

  private queryAllVisible(selector: string, root: Document | Element = document): Element[] {
    return this.queryAll(selector, root).filter((element) => this.isVisible(element));
  }

  /**
   * Detect currently active IRCTC or Mock screen
   */
  detectScreen(doc: Document = document): FormDetectionResult {
    const screens = this.schema.screens;

    // Check Confirmation Screen
    if (this.queryVisible(screens.confirmation.indicator, doc) || this.queryVisible(screens.confirmation.pnrElement, doc)) {
      return {
        activeScreen: 'CONFIRMATION',
        schemaVersion: this.schema.version,
        isSupported: true,
        manualFallbackMode: false,
        detectedElements: { hasPassengerRows: false, hasCaptcha: false, hasPaymentOptions: false }
      };
    }

    // Check Payment Gateway Screen
    if (this.queryVisible(screens.paymentGateway.indicator, doc) || this.queryVisible(screens.paymentGateway.payButton, doc)) {
      return {
        activeScreen: 'PAYMENT_GATEWAY',
        schemaVersion: this.schema.version,
        isSupported: true,
        manualFallbackMode: false,
        detectedElements: { hasPassengerRows: false, hasCaptcha: false, hasPaymentOptions: true }
      };
    }

    // Check Review & Captcha Screen
    if (this.queryVisible(screens.reviewAndCaptcha.indicator, doc) || this.queryVisible(screens.reviewAndCaptcha.captchaInput, doc)) {
      return {
        activeScreen: 'REVIEW_AND_CAPTCHA',
        schemaVersion: this.schema.version,
        isSupported: true,
        manualFallbackMode: false,
        detectedElements: { hasPassengerRows: false, hasCaptcha: true, hasPaymentOptions: false }
      };
    }

    // Check Passenger Form Screen
    const passengerRows = this.queryAllVisible(screens.passengerDetails.passengerRows, doc);
    if (this.queryVisible(screens.passengerDetails.indicator, doc) || passengerRows.length > 0 || this.queryVisible(screens.passengerDetails.contactMobile, doc)) {
      return {
        activeScreen: 'PASSENGER_DETAILS',
        schemaVersion: this.schema.version,
        isSupported: true,
        manualFallbackMode: false,
        detectedElements: { hasPassengerRows: passengerRows.length > 0, hasCaptcha: false, hasPaymentOptions: false }
      };
    }

    // Check Train Search Screen
    if (this.queryVisible(screens.trainSearch.indicator, doc) || this.queryVisible(screens.trainSearch.searchButton, doc)) {
      return {
        activeScreen: 'TRAIN_SEARCH',
        schemaVersion: this.schema.version,
        isSupported: true,
        manualFallbackMode: false,
        detectedElements: { hasPassengerRows: false, hasCaptcha: false, hasPaymentOptions: false }
      };
    }

    // Fallback if URL is IRCTC but DOM selectors do not match (e.g. IRCTC revised markup)
    const isIrctcUrl = typeof window !== 'undefined' && (
      window.location.hostname.includes('irctc.co.in') ||
      window.location.hostname.includes('localhost')
    );

    return {
      activeScreen: 'UNKNOWN',
      schemaVersion: this.schema.version,
      isSupported: isIrctcUrl,
      manualFallbackMode: isIrctcUrl, // Fall back to manual timing HUD without crashing
      detectedElements: { hasPassengerRows: false, hasCaptcha: false, hasPaymentOptions: false }
    };
  }

  getSchema(): SelectorSchema {
    return this.schema;
  }
}

export const formDetector = new FormDetector();

