/**
 * Versioned Selector Registry (v1)
 * Isolated DOM selectors for IRCTC and Mock Tatkal portal
 */

export interface SelectorSchema {
  version: string;
  screens: {
    trainSearch: {
      indicator: string;
      originInput: string;
      destInput: string;
      journeyDate: string;
      quotaDropdown: string;
      searchButton: string;
    };
    passengerDetails: {
      indicator: string;
      passengerRows: string;
      passengerName: string;
      passengerAge: string;
      passengerGender: string;
      passengerBerth: string;
      passengerFood: string;
      addPassengerButton: string;
      contactMobile: string;
      autoUpgradeCheckbox: string;
      confirmBerthsCheckbox: string;
      travelInsuranceRadio: string;
      paymentModeUpiRadio: string;
      paymentModeCardRadio: string;
      continueButton: string;
    };
    reviewAndCaptcha: {
      indicator: string;
      captchaImage: string;
      captchaInput: string;
      submitButton: string;
      ticketDetailsSummary: string;
    };
    paymentGateway: {
      indicator: string;
      upiOption: string;
      cardOption: string;
      payButton: string;
    };
    confirmation: {
      indicator: string;
      pnrElement: string;
      statusBadge: string;
    };
  };
}

export const SELECTORS_V1: SelectorSchema = {
  version: 'v1.2026.08',
  screens: {
    trainSearch: {
      indicator: '[data-screen="train-search"], #origin, .train-search-form, .ui-autocomplete-input',
      originInput: '#origin, input[placeholder*="From"], [formcontrolname="origin"]',
      destInput: '#destination, input[placeholder*="To"], [formcontrolname="destination"]',
      journeyDate: '#journeyDate, input[placeholder*="Date"]',
      quotaDropdown: '#quotaSelect, .quota-select, select[name="quota"]',
      searchButton: '#searchTrainsBtn, button[type="submit"].search_btn'
    },
    passengerDetails: {
      indicator: '[data-screen="passenger-details"], #passenger-form, .passenger-form-container, app-passenger-input',
      passengerRows: '.passenger-row, [data-passenger-row], .psgn-card',
      passengerName: 'input[name="passengerName"], input[placeholder*="Name"], .psgn-name-input, [data-field="name"]',
      passengerAge: 'input[name="passengerAge"], input[placeholder*="Age"], .psgn-age-input, [data-field="age"]',
      passengerGender: 'select[name="passengerGender"], .psgn-gender-select, [data-field="gender"]',
      passengerBerth: 'select[name="passengerBerth"], .psgn-berth-select, [data-field="berth"]',
      passengerFood: 'select[name="passengerFood"], .psgn-food-select, [data-field="food"]',
      addPassengerButton: '#addPassengerBtn, .add-passenger-btn, button:has-text("+ Add Passenger")',
      contactMobile: '#mobileNumber, input[name="mobileNumber"], input[placeholder*="Mobile"], [data-field="mobile"]',
      autoUpgradeCheckbox: '#autoUpgrade, input[name="autoUpgrade"], [data-field="auto-upgrade"]',
      confirmBerthsCheckbox: '#confirmBerths, input[name="confirmBerths"], [data-field="confirm-berths"]',
      travelInsuranceRadio: 'input[name="travelInsurance"][value="yes"], #insuranceYes, [data-field="insurance-yes"]',
      paymentModeUpiRadio: '#payModeUpi, input[name="paymentMode"][value="UPI"], [data-field="pay-upi"]',
      paymentModeCardRadio: '#payModeCard, input[name="paymentMode"][value="CARD"], [data-field="pay-card"]',
      continueButton: '#passengerContinueBtn, .passenger-continue-btn, button[type="submit"]'
    },
    reviewAndCaptcha: {
      indicator: '[data-screen="review-captcha"], #captcha-section, .captcha-container, app-review-booking',
      captchaImage: '#captchaImg, .captcha-img, img[alt*="captcha" i]',
      captchaInput: '#captchaInput, input[name="captcha"], input[placeholder*="captcha" i]',
      submitButton: '#reviewContinueBtn, .review-submit-btn, button.btn-continue',
      ticketDetailsSummary: '.ticket-summary, #bookingSummary'
    },
    paymentGateway: {
      indicator: '[data-screen="payment-gateway"], #payment-options, .payment-gateway-wrapper',
      upiOption: '#tabUpi, .upi-pay-option, [data-paymethod="upi"]',
      cardOption: '#tabCard, .card-pay-option, [data-paymethod="card"]',
      payButton: '#makePaymentBtn, .pay-now-btn, button[id*="pay" i]'
    },
    confirmation: {
      indicator: '[data-screen="booking-confirmation"], #bookingConfirmation, .confirmation-box, .pnr-container',
      pnrElement: '#pnrNumber, .pnr-number, [data-pnr]',
      statusBadge: '.booking-status, .badge-success, [data-booking-status]'
    }
  }
};

