import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { EncryptedVaultBlob } from '@irctc-tatkal/shared';
import { db } from '../database/db';
import { AuthenticatedRequest } from '../middleware/auth';

export class ProfilesController {
  /**
   * Get all encrypted vault profiles for the authenticated user.
   * Returns ciphertext blobs and IVs only.
   */
  static async listProfiles(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });

      const blobs = db.getVaultBlobsByUserId(userId);
      return res.status(200).json({
        success: true,
        data: blobs
      });
    } catch (err: any) {
      console.error('[Profiles.list] Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve encrypted profiles.' });
    }
  }

  /**
   * Get single encrypted vault profile.
   */
  static async getProfileById(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });

      const blob = db.getVaultBlobById(id, userId);
      if (!blob) {
        return res.status(404).json({ success: false, error: 'Profile not found.' });
      }

      return res.status(200).json({
        success: true,
        data: blob
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  }

  /**
   * Upload / create a new zero-knowledge encrypted profile blob.
   * STRICT ZERO-KNOWLEDGE AUDIT:
   * - Ciphertext, IV, and Salt are required.
   * - Reject if plaintext passenger structures are mistakenly passed.
   */
  static async createProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });

      const { profileName, ciphertext, iv, salt, version } = req.body;

      // Security check: Never accept unencrypted passenger arrays
      if (req.body.passengers || req.body.passengerList || req.body.irctcPassword) {
        return res.status(400).json({
          success: false,
          error: 'Security Violation: Server only accepts zero-knowledge encrypted blobs (ciphertext, iv, salt). Plaintext data is strictly rejected.'
        });
      }

      if (!profileName || !ciphertext || !iv || !salt) {
        return res.status(400).json({
          success: false,
          error: 'Missing required encryption fields: profileName, ciphertext, iv, and salt must be provided.'
        });
      }

      if (typeof ciphertext !== 'string' || typeof iv !== 'string' || typeof salt !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid format: ciphertext, iv, and salt must be Base64-encoded strings.'
        });
      }

      const now = new Date().toISOString();
      const newBlob: EncryptedVaultBlob = {
        id: uuidv4(),
        userId,
        profileName: String(profileName).trim(),
        ciphertext,
        iv,
        salt,
        version: typeof version === 'number' ? version : 1,
        createdAt: now,
        updatedAt: now
      };

      db.saveVaultBlob(newBlob);

      return res.status(201).json({
        success: true,
        message: 'Encrypted profile saved successfully.',
        data: newBlob
      });
    } catch (err: any) {
      console.error('[Profiles.create] Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to save encrypted profile.' });
    }
  }

  /**
   * Update an existing encrypted vault blob.
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });

      const existing = db.getVaultBlobById(id, userId);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Profile not found.' });
      }

      // Security check: Never accept unencrypted passenger arrays
      if (req.body.passengers || req.body.passengerList || req.body.irctcPassword) {
        return res.status(400).json({
          success: false,
          error: 'Security Violation: Server only accepts zero-knowledge encrypted blobs.'
        });
      }

      const { profileName, ciphertext, iv, salt, version } = req.body;

      const updatedBlob: EncryptedVaultBlob = {
        ...existing,
        profileName: profileName ? String(profileName).trim() : existing.profileName,
        ciphertext: ciphertext || existing.ciphertext,
        iv: iv || existing.iv,
        salt: salt || existing.salt,
        version: typeof version === 'number' ? version : existing.version,
        updatedAt: new Date().toISOString()
      };

      db.saveVaultBlob(updatedBlob);

      return res.status(200).json({
        success: true,
        message: 'Encrypted profile updated successfully.',
        data: updatedBlob
      });
    } catch (err: any) {
      console.error('[Profiles.update] Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update encrypted profile.' });
    }
  }

  /**
   * Delete an encrypted profile.
   */
  static async deleteProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });

      const deleted = db.deleteVaultBlob(id, userId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Profile not found.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Profile deleted successfully.'
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Server error.' });
    }
  }
}

