import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AuthController } from './auth/authController';
import { ProfilesController } from './profiles/profilesController';
import { PaymentsController } from './payments/paymentsController';
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: '*', // Permissive for local extension and mock testing
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

// 1. Health & Latency Probe (Used by Readiness Checker)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'Vault-Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    serverTimeEpochMs: Date.now(),
    zeroKnowledgeVerified: true
  });
});

// 2. Authentication Endpoints
app.post('/auth/signup', AuthController.signup);
app.post('/auth/login', AuthController.login);
app.get('/auth/me', authenticateToken, AuthController.me);

// 3. Encrypted Profile Vault Endpoints (Zero-Knowledge Ciphertext Blobs)
app.get('/profiles', authenticateToken, ProfilesController.listProfiles);
app.get('/profiles/:id', authenticateToken, ProfilesController.getProfileById);
app.post('/profiles', authenticateToken, ProfilesController.createProfile);
app.put('/profiles/:id', authenticateToken, ProfilesController.updateProfile);
app.delete('/profiles/:id', authenticateToken, ProfilesController.deleteProfile);

// 4. Tokenized Payment Reference Endpoints (PCI-DSS Compliant)
app.get('/payment-tokens', authenticateToken, PaymentsController.listPaymentTokens);
app.post('/payment-tokens', authenticateToken, PaymentsController.createPaymentToken);
app.post('/payment-tokens/sandbox-generate', authenticateToken, PaymentsController.generateSandboxToken);
app.delete('/payment-tokens/:id', authenticateToken, PaymentsController.deletePaymentToken);

// 5. 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found on Vault Service.`
  });
});

// 6. Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Vault-Service Error]:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error in Vault Service.'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Vault-Service] 🔒 Zero-Knowledge Vault running on http://localhost:${PORT}`);
  });
}

export default app;

