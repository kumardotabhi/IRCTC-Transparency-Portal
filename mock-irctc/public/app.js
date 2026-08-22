/**
 * Simulated IRCTC Portal Client Application
 */

const screens = {
  search: document.getElementById('screen-train-search'),
  passengers: document.getElementById('screen-passenger-details'),
  review: document.getElementById('screen-review-captcha'),
  payment: document.getElementById('screen-payment-gateway'),
  confirmation: document.getElementById('screen-booking-confirmation')
};

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const loadingTimer = document.getElementById('loadingTimer');
const latencySelect = document.getElementById('latencyProfileSelect');
const istClock = document.getElementById('liveIstClock');

// Live IST Clock simulation
setInterval(() => {
  const d = new Date();
  istClock.textContent = `IST ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}, 1000);

function showScreen(screenKey) {
  Object.keys(screens).forEach((key) => {
    screens[key].classList.add('hidden');
  });
  screens[screenKey].classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getSimulatedDelay() {
  const profile = latencySelect.value;
  if (profile === 'NORMAL') return 250;
  if (profile === 'TATKAL_RUSH') return 4200; // 4.2s simulated server response delay
  if (profile === 'PAYMENT_SLOW') return 7500; // 7.5s payment gateway delay
  return 1500;
}

function simulateAsyncAction(actionName, durationMs, callback) {
  loadingText.textContent = actionName;
  loadingTimer.textContent = `${(durationMs / 1000).toFixed(1)}s simulated server latency`;
  loadingOverlay.classList.remove('hidden');

  let remaining = durationMs;
  const interval = setInterval(() => {
    remaining -= 200;
    if (remaining > 0) {
      loadingTimer.textContent = `${(remaining / 1000).toFixed(1)}s remaining...`;
    }
  }, 200);

  setTimeout(() => {
    clearInterval(interval);
    loadingOverlay.classList.add('hidden');
    callback();
  }, durationMs);
}

// 1. Search Form
const trainSearchForm = document.getElementById('trainSearchForm');
const trainResultsContainer = document.getElementById('trainResultsContainer');
const bookNowBtn = document.getElementById('bookNowBtn');
const seatCountBadge = document.getElementById('seatCountBadge');

trainSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const delay = getSimulatedDelay();
  simulateAsyncAction('Connecting to CRIS PRS Database...', delay, () => {
    if (latencySelect.value === 'SEATS_EXHAUSTED') {
      seatCountBadge.textContent = 'REGRET / NOT AVAILABLE';
      seatCountBadge.className = 'text-rose-700 font-extrabold text-sm';
      bookNowBtn.disabled = true;
      bookNowBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      seatCountBadge.textContent = 'AVAILABLE - 16';
      seatCountBadge.className = 'text-emerald-700 font-extrabold text-sm';
      bookNowBtn.disabled = false;
      bookNowBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    trainResultsContainer.classList.remove('hidden');
  });
});

bookNowBtn.addEventListener('click', () => {
  const delay = Math.round(getSimulatedDelay() / 3);
  simulateAsyncAction('Loading Passenger Form...', delay, () => {
    showScreen('passengers');
  });
});

// 2. Passenger Form
const passengerForm = document.getElementById('passengerForm');
const passengerRowsContainer = document.getElementById('passengerRowsContainer');
const addPassengerBtn = document.getElementById('addPassengerBtn');
const backToSearchBtn = document.getElementById('backToSearchBtn');

addPassengerBtn.addEventListener('click', () => {
  const count = passengerRowsContainer.children.length;
  if (count >= 4) {
    alert('Maximum 4 passengers allowed under Tatkal quota.');
    return;
  }
  const row = document.createElement('div');
  row.className = 'passenger-row p-3.5 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center';
  row.innerHTML = `
    <div class="md:col-span-1 text-xs font-bold text-slate-500 text-center">Psgn ${count + 1}</div>
    <div class="md:col-span-4">
      <label class="text-[10px] font-bold text-slate-600 block mb-0.5">Passenger Name</label>
      <input type="text" name="passengerName" placeholder="Name" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none" />
    </div>
    <div class="md:col-span-2">
      <label class="text-[10px] font-bold text-slate-600 block mb-0.5">Age</label>
      <input type="number" name="passengerAge" placeholder="Age" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none" />
    </div>
    <div class="md:col-span-2">
      <label class="text-[10px] font-bold text-slate-600 block mb-0.5">Gender</label>
      <select name="passengerGender" class="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none">
        <option value="">Select</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Transgender">Transgender</option>
      </select>
    </div>
    <div class="md:col-span-3">
      <label class="text-[10px] font-bold text-slate-600 block mb-0.5">Berth Preference</label>
      <select name="passengerBerth" class="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none">
        <option value="No Preference">No Preference</option>
        <option value="Lower">Lower</option>
        <option value="Middle">Middle</option>
        <option value="Upper">Upper</option>
        <option value="Side Lower">Side Lower</option>
        <option value="Side Upper">Side Upper</option>
      </select>
    </div>
  `;
  passengerRowsContainer.appendChild(row);
});

backToSearchBtn.addEventListener('click', () => {
  showScreen('search');
});

passengerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const names = Array.from(document.querySelectorAll('input[name="passengerName"]'))
    .map((el) => el.value.trim())
    .filter(Boolean);

  if (names.length === 0) {
    alert('Please enter at least one passenger name (or click 1-Click Vault Autofill in the extension overlay)!');
    return;
  }

  // Populate review screen summary
  const reviewContainer = document.getElementById('reviewPassengersList');
  reviewContainer.innerHTML = names.map((name, i) => `<div>${i + 1}. <strong>${name}</strong> (Adult)</div>`).join('');

  const delay = Math.round(getSimulatedDelay() / 2);
  simulateAsyncAction('Verifying Passenger Details with PRS...', delay, () => {
    generateCaptcha();
    showScreen('review');
  });
});

// 3. Review & Captcha Form
const captchaImg = document.getElementById('captchaImg');
const captchaInput = document.getElementById('captchaInput');
const refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');
const reviewContinueBtn = document.getElementById('reviewContinueBtn');
const backToPassengerBtn = document.getElementById('backToPassengerBtn');

let activeCaptcha = '9X4KT';

function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let str = '';
  for (let i = 0; i < 5; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  activeCaptcha = str;
  captchaImg.textContent = str;
  captchaInput.value = '';
}

refreshCaptchaBtn.addEventListener('click', generateCaptcha);

backToPassengerBtn.addEventListener('click', () => {
  showScreen('passengers');
});

reviewContinueBtn.addEventListener('click', () => {
  if (!captchaInput.value.trim()) {
    alert('Please enter the visual CAPTCHA verification code.');
    captchaInput.focus();
    return;
  }
  if (captchaInput.value.trim().toUpperCase() !== activeCaptcha) {
    alert('Invalid CAPTCHA code. Please try again.');
    generateCaptcha();
    return;
  }

  const delay = Math.round(getSimulatedDelay() / 2);
  simulateAsyncAction('Redirecting to Payment Gateway...', delay, () => {
    showScreen('payment');
  });
});

// 4. Payment Gateway
const makePaymentBtn = document.getElementById('makePaymentBtn');

makePaymentBtn.addEventListener('click', () => {
  const delay = latencySelect.value === 'PAYMENT_SLOW' ? 7500 : 2800;
  simulateAsyncAction('Processing Bank Transaction & PNR Allocation...', delay, () => {
    showScreen('confirmation');
  });
});

// 5. Confirmation
const bookAnotherBtn = document.getElementById('bookAnotherBtn');
bookAnotherBtn.addEventListener('click', () => {
  showScreen('search');
});

