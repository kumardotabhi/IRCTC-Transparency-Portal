import { encryptData, decryptData, sha256Hex } from '../crypto';

async function runCryptoTests() {
  console.log('🧪 Starting Client-Side Cryptography Unit Tests...');

  const mockPassengerVault = {
    version: 1,
    profileName: 'Bangalore Tatkal Express',
    passengers: [
      {
        id: 'p1',
        name: 'Arun Kumar',
        age: 29,
        gender: 'M',
        berthPreference: 'LOWER',
        foodPreference: 'V'
      },
      {
        id: 'p2',
        name: 'Priya Sharma',
        age: 27,
        gender: 'F',
        berthPreference: 'LOWER',
        foodPreference: 'V'
      }
    ],
    preferences: {
      autoUpgrade: true,
      bookOnlyIfConfirmed: true,
      mobileNumber: '9876543210',
      travelInsuranceOptIn: true,
      paymentMethodPreference: 'UPI'
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const masterPassphrase = 'MySuperSecretTatkalPassphrase#2026';

  // Test 1: Encrypt and Decrypt Round-Trip
  {
    const encrypted = await encryptData(mockPassengerVault, masterPassphrase);
    if (!encrypted.ciphertext || !encrypted.iv || !encrypted.salt) {
      throw new Error('Encryption did not produce required ciphertext, iv, and salt.');
    }

    const decrypted = await decryptData(encrypted, masterPassphrase);
    if (JSON.stringify(decrypted) === JSON.stringify(mockPassengerVault)) {
      console.log('  ✅ [PASS] AES-GCM-256 Encrypt/Decrypt round-trip successful');
    } else {
      throw new Error('Decrypted data does not match original plaintext.');
    }
  }

  // Test 2: Decryption Failure with Wrong Passphrase
  {
    const encrypted = await encryptData(mockPassengerVault, masterPassphrase);
    let failedAsExpected = false;
    try {
      await decryptData(encrypted, 'WrongPassphraseWrong123!');
    } catch (err: any) {
      failedAsExpected = true;
    }

    if (failedAsExpected) {
      console.log('  ✅ [PASS] Decryption correctly rejected with invalid master passphrase');
    } else {
      throw new Error('Decryption did not fail on invalid passphrase!');
    }
  }

  // Test 3: One-Way SHA-256 Session Anonymization Hash
  {
    const hash1 = await sha256Hex('session_12345_salt_999');
    const hash2 = await sha256Hex('session_12345_salt_999');
    const hash3 = await sha256Hex('session_different_salt_999');

    if (hash1.length === 64 && hash1 === hash2 && hash1 !== hash3) {
      console.log('  ✅ [PASS] SHA-256 one-way deterministic session hash verified');
    } else {
      throw new Error('SHA-256 hashing failed.');
    }
  }

  console.log('✨ All Cryptography Tests Passed Successfully!\n');
}

runCryptoTests().catch((err) => {
  console.error('❌ Crypto Tests Failed:', err);
  process.exit(1);
});

