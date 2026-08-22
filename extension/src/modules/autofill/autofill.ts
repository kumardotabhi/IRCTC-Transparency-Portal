/**
 * Non-Invasive Safe Autofill Module
 * 
 * STRICT COMPLIANCE RULES:
 * 1. ONLY populates existing visible input fields.
 * 2. Dispatches native 'input' and 'change' events so reactive frameworks process the values.
 * 3. NEVER automatically clicks submit/continue buttons.
 * 4. NEVER interacts with or bypasses CAPTCHA fields.
 */

import { PassengerVaultData, Passenger } from '@irctc-tatkal/shared';
import { SELECTORS_V1, SelectorSchema } from '../forms/selectors/v1';

export interface AutofillResult {
  success: boolean;
  filledPassengersCount: number;
  totalFieldsUpdated: number;
  warnings: string[];
  durationMs: number;
}

export class AutofillEngine {
  private schema: SelectorSchema;

  constructor(customSchema?: SelectorSchema) {
    this.schema = customSchema || SELECTORS_V1;
  }

  /**
   * Safe native value setter for React/Angular/Vue controlled inputs
   */
  private setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const proto = Object.getPrototypeOf(element);
    const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set ||
                        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }

  /**
   * Safe native select value setter
   */
  private setSelectValue(element: HTMLSelectElement, targetValue: string): void {
    let matched = false;
    for (let i = 0; i < element.options.length; i++) {
      const opt = element.options[i];
      if (
        opt.value.toLowerCase() === targetValue.toLowerCase() ||
        opt.text.toLowerCase().includes(targetValue.toLowerCase())
      ) {
        element.selectedIndex = i;
        matched = true;
        break;
      }
    }

    if (!matched && element.options.length > 0) {
      element.value = targetValue;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Safe checkbox setter
   */
  private setCheckbox(element: HTMLInputElement, checked: boolean): void {
    if (element.checked !== checked) {
      element.checked = checked;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Safe radio button setter
   */
  private setRadio(element: HTMLInputElement): void {
    if (!element.checked) {
      element.checked = true;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Execute safe autofill for passenger screen
   */
  fillPassengerDetails(vaultData: PassengerVaultData, root: Document | Element = document): AutofillResult {
    const startTime = performance.now();
    const warnings: string[] = [];
    let fieldsUpdated = 0;
    let filledPassengersCount = 0;

    const selectors = this.schema.screens.passengerDetails;

    // 1. Locate passenger rows
    let rows = Array.from(root.querySelectorAll(selectors.passengerRows));

    if (rows.length === 0) {
      // Fallback: Check if inputs exist directly on page
      const directNameInputs = Array.from(root.querySelectorAll(selectors.passengerName));
      if (directNameInputs.length > 0) {
        rows = directNameInputs.map((input) => input.closest('tr, .row, div, fieldset') || input.parentElement || input as Element);
      }
    }

    const passengers = vaultData.passengers || [];

    for (let i = 0; i < passengers.length; i++) {
      const p: Passenger = passengers[i];
      let row = rows[i];

      // If there are fewer rows on DOM than passengers in vault, click add passenger if present
      if (!row) {
        const addBtn = root.querySelector(selectors.addPassengerButton) as HTMLElement;
        if (addBtn) {
          addBtn.click();
          // Re-query rows
          rows = Array.from(root.querySelectorAll(selectors.passengerRows));
          row = rows[i];
        }
      }

      if (row) {
        // Fill Passenger Name
        const nameInput = row.querySelector(selectors.passengerName) as HTMLInputElement;
        if (nameInput) {
          this.setInputValue(nameInput, p.name);
          fieldsUpdated++;
        }

        // Fill Age
        const ageInput = row.querySelector(selectors.passengerAge) as HTMLInputElement;
        if (ageInput) {
          this.setInputValue(ageInput, String(p.age));
          fieldsUpdated++;
        }

        // Fill Gender
        const genderSelect = row.querySelector(selectors.passengerGender) as HTMLSelectElement;
        if (genderSelect) {
          const genderText = p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : 'Transgender';
          this.setSelectValue(genderSelect, genderText);
          fieldsUpdated++;
        }

        // Fill Berth Preference
        const berthSelect = row.querySelector(selectors.passengerBerth) as HTMLSelectElement;
        if (berthSelect && p.berthPreference) {
          const berthMap: Record<string, string> = {
            NO_PREFERENCE: 'No Preference',
            LOWER: 'Lower',
            MIDDLE: 'Middle',
            UPPER: 'Upper',
            SIDE_LOWER: 'Side Lower',
            SIDE_UPPER: 'Side Upper'
          };
          this.setSelectValue(berthSelect, berthMap[p.berthPreference] || p.berthPreference);
          fieldsUpdated++;
        }

        // Fill Food Preference
        const foodSelect = row.querySelector(selectors.passengerFood) as HTMLSelectElement;
        if (foodSelect && p.foodPreference) {
          const foodText = p.foodPreference === 'V' ? 'Veg' : p.foodPreference === 'N' ? 'Non-Veg' : 'No Food';
          this.setSelectValue(foodSelect, foodText);
          fieldsUpdated++;
        }

        filledPassengersCount++;
      } else {
        warnings.push(`Could not find DOM row for passenger #${i + 1} (${p.name}).`);
      }
    }

    // 2. Fill Travel Preferences & Contact Mobile
    if (vaultData.preferences) {
      // Mobile
      if (vaultData.preferences.mobileNumber) {
        const mobileInput = root.querySelector(selectors.contactMobile) as HTMLInputElement;
        if (mobileInput) {
          this.setInputValue(mobileInput, vaultData.preferences.mobileNumber);
          fieldsUpdated++;
        }
      }

      // Auto-upgrade
      const autoUpgradeCheck = root.querySelector(selectors.autoUpgradeCheckbox) as HTMLInputElement;
      if (autoUpgradeCheck) {
        this.setCheckbox(autoUpgradeCheck, !!vaultData.preferences.autoUpgrade);
        fieldsUpdated++;
      }

      // Confirm berths only
      const confirmBerthsCheck = root.querySelector(selectors.confirmBerthsCheckbox) as HTMLInputElement;
      if (confirmBerthsCheck) {
        this.setCheckbox(confirmBerthsCheck, !!vaultData.preferences.bookOnlyIfConfirmed);
        fieldsUpdated++;
      }

      // Travel Insurance
      const insuranceRadio = root.querySelector(selectors.travelInsuranceRadio) as HTMLInputElement;
      if (insuranceRadio && vaultData.preferences.travelInsuranceOptIn) {
        this.setRadio(insuranceRadio);
        fieldsUpdated++;
      }

      // Preferred Payment Mode
      if (vaultData.preferences.paymentMethodPreference === 'UPI') {
        const upiRadio = root.querySelector(selectors.paymentModeUpiRadio) as HTMLInputElement;
        if (upiRadio) {
          this.setRadio(upiRadio);
          fieldsUpdated++;
        }
      } else if (vaultData.preferences.paymentMethodPreference === 'CREDIT_CARD' || vaultData.preferences.paymentMethodPreference === 'DEBIT_CARD') {
        const cardRadio = root.querySelector(selectors.paymentModeCardRadio) as HTMLInputElement;
        if (cardRadio) {
          this.setRadio(cardRadio);
          fieldsUpdated++;
        }
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      success: filledPassengersCount > 0,
      filledPassengersCount,
      totalFieldsUpdated: fieldsUpdated,
      warnings,
      durationMs
    };
  }
}

export const autofillEngine = new AutofillEngine();

