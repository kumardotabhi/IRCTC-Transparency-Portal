import { db } from '../database/db';
import { AuthController } from '../auth/authController';
import { ProfilesController } from '../profiles/profilesController';
import { PaymentsController } from '../payments/paymentsController';

function createMockReqRes(body: any = {}, user?: any, params: any = {}) {
  const req: any = { body, user, params, headers: {} };
  let statusCode = 200;
  let responseData: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getResponseData: () => responseData
  };

  return { req, res };
}

async function runVaultTests() {
  console.log('🧪 Starting Vault Service Unit Tests...');
  db.clearAll();

  // Test 1: User Signup
  {
    const { req, res } = createMockReqRes({
      email: 'tatkal.tester@example.com',
      password: 'SecureMasterPassword123!'
    });
    await AuthController.signup(req, res);
    const data = res.getResponseData();
    if (res.getStatusCode() === 201 && data.success && data.data.token) {
      console.log('  ✅ [PASS] User Signup with JWT generation');
    } else {
      throw new Error(`User signup failed: ${JSON.stringify(data)}`);
    }
  }

  // Test 2: User Login
  let authToken = '';
  let userId = '';
  {
    const { req, res } = createMockReqRes({
      email: 'tatkal.tester@example.com',
      password: 'SecureMasterPassword123!'
    });
    await AuthController.login(req, res);
    const data = res.getResponseData();
    if (res.getStatusCode() === 200 && data.success && data.data.token) {
      authToken = data.data.token;
      userId = data.data.user.id;
      console.log('  ✅ [PASS] User Login with password verification');
    } else {
      throw new Error(`User login failed: ${JSON.stringify(data)}`);
    }
  }

  // Test 3: Zero-Knowledge Profile Creation (Valid Ciphertext)
  let profileId = '';
  {
    const mockCiphertext = 'AES_GCM_ENCRYPTED_BLOB_BASE64_ABC123XYZ==';
    const mockIv = '12BYTE_IV_BASE64==';
    const mockSalt = '16BYTE_SALT_BASE64==';

    const { req, res } = createMockReqRes({
      profileName: 'Family Tatkal (2 Adults, 1 Child)',
      ciphertext: mockCiphertext,
      iv: mockIv,
      salt: mockSalt,
      version: 1
    }, { userId, email: 'tatkal.tester@example.com' });

    await ProfilesController.createProfile(req, res);
    const data = res.getResponseData();
    if (res.getStatusCode() === 201 && data.success && data.data.ciphertext === mockCiphertext) {
      profileId = data.data.id;
      console.log('  ✅ [PASS] Zero-knowledge encrypted profile stored as ciphertext');
    } else {
      throw new Error(`Profile creation failed: ${JSON.stringify(data)}`);
    }
  }

  // Test 4: Zero-Knowledge Plaintext Rejection (Security Guardrail)
  {
    const { req, res } = createMockReqRes({
      profileName: 'Unencrypted Profile',
      passengers: [{ name: 'John Doe', age: 30 }] // Plaintext attempt!
    }, { userId, email: 'tatkal.tester@example.com' });

    await ProfilesController.createProfile(req, res);
    const data = res.getResponseData();
    if (res.getStatusCode() === 400 && data.success === false && data.error.includes('Security Violation')) {
      console.log('  ✅ [PASS] Plaintext passenger data strictly rejected by Vault server');
    } else {
      throw new Error(`Security guard failed to reject plaintext: ${JSON.stringify(data)}`);
    }
  }

  // Test 5: Profile List Retrieval
  {
    const { req, res } = createMockReqRes({}, { userId, email: 'tatkal.tester@example.com' });
    await ProfilesController.listProfiles(req, res);
    const data = res.getResponseData();
    if (res.getStatusCode() === 200 && data.success && Array.isArray(data.data) && data.data.length === 1) {
      console.log('  ✅ [PASS] Encrypted profiles listed successfully for user');
    } else {
      throw new Error(`Profile list failed: ${JSON.stringify(data)}`);
    }
  }

  // Test 6: Payment Token Storage (PCI-DSS Compliant)
  let paymentId = '';
  {
    const { req, res } = createMockReqRes({
      provider: 'RAZORPAY_SANDBOX',
      tokenRef: 'tok_sandbox_tatkal_card_9921',
      cardLast4: '8834',
      cardNetwork: 'RUPAY',
      label: 'Personal Tatkal RuPay'
    }, { userId, email: 'tatkal.tester@example.com' });

    await PaymentsController.createPaymentToken(req, res);
    const data = res.getResponseData();
    if (res.getStatusCode() === 201 && data.success && data.data.tokenRef) {
      paymentId = data.data.id;
      console.log('  ✅ [PASS] Payment token reference saved (no raw card data)');
    } else {
      throw new Error(`Payment token creation failed: ${JSON.stringify(data)}`);
    }
  }

  // Test 7: Payment Raw Card Rejection (PCI-DSS Security Guardrail)
  {
    const { req, res } = createMockReqRes({
      cardNumber: '4111222233334444', // Raw card attempt!
      cvv: '123'
    }, { userId, email: 'tatkal.tester@example.com' });

    await PaymentsController.createPaymentToken(req, res);
    const data = res.getResponseData();
    if (res.getStatusCode() === 400 && data.success === false && data.error.includes('PCI-DSS Violation')) {
      console.log('  ✅ [PASS] Raw card numbers and CVVs strictly rejected');
    } else {
      throw new Error(`PCI guard failed to reject raw card: ${JSON.stringify(data)}`);
    }
  }

  console.log('✨ All Vault Service Unit Tests Passed Successfully!\n');
}

runVaultTests().catch((err) => {
  console.error('❌ Vault Service Tests Failed:', err);
  process.exit(1);
});

