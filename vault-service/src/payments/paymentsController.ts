import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PaymentTokenRef } from '@irctc-tatkal/shared';
import { db } from '../database/db';
import { AuthenticatedRequest } from '../middleware/auth';

export class PaymentsController {
  /**
   * List tokenized payment references for user.
   */
  static async listPaymentTokens(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });

      const tokens = db.getPaymentTokensByUserId(userId);
      return res.status(200).json({
        success: true,
        data: tokens
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Failed to retrieve payment tokens.' });
    }
  }

  /**
   * Save a tokenized payment reference (e.g. from Razorpay sandbox or Stripe test mode).
   * STRICT PCI-DSS GUARD:
   * - Rejects raw card numbers, CVV, or PINs.
   * - Stores only opaque tokenRef (e.g. 'tok_1N...'), masked last 4, network, and label.
   */
  static async createPaymentToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });

      // Explicitly reject any attempts to pass raw card details or CVVs
      if (req.body.cardNumber || req.body.cvv || req.body.cvc || req.body.upiPin || req.body.pin) {
        return res.status(400).json({
          success: false,
          error: 'PCI-DSS Violation: Raw card numbers and security codes must never be transmitted. Only tokenized references (tok_*) are accepted.'
        });
      }

      const { provider, tokenRef, cardLast4, cardNetwork, upiHandleMasked, label } = req.body;

      if (!tokenRef || typeof tokenRef !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'A valid provider token reference (e.g. tok_...) is required.'
        });
      }

      const newToken: PaymentTokenRef = {
        id: uuidv4(),
        userId,
        provider: provider || 'RAZORPAY_SANDBOX',
        tokenRef,
        cardLast4: cardLast4 ? String(cardLast4).slice(-4) : undefined,
        cardNetwork: cardNetwork || 'RUPAY',
        upiHandleMasked: upiHandleMasked ? String(upiHandleMasked) : undefined,
        label: label ? String(label) : 'Quick Tatkal Payment Card',
        createdAt: new Date().toISOString()
      };

      db.savePaymentToken(newToken);

      return res.status(201).json({
        success: true,
        message: 'Payment token saved successfully.',
        data: newToken
      });
    } catch (err: any) {
      console.error('[Payments.create] Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to save payment token reference.' });
    }
  }

  /**
   * Generate a mock sandbox token for hackathon testing without real banking calls.
   */
  static async generateSandboxToken(req: AuthenticatedRequest, res: Response) {
    try {
      const { method, last4, label } = req.body;
      const mockToken = `tok_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      return res.status(200).json({
        success: true,
        data: {
          tokenRef: mockToken,
          provider: 'RAZORPAY_SANDBOX',
          cardLast4: last4 || '4242',
          cardNetwork: 'RUPAY',
          label: label || 'Test RuPay Card'
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Failed to generate sandbox token.' });
    }
  }

  /**
   * Delete a tokenized payment reference.
   */
  static async deletePaymentToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });

      const deleted = db.deletePaymentToken(id, userId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Payment token not found.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Payment token removed successfully.'
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  }
}

