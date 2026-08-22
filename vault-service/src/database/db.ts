import fs from 'fs';
import path from 'path';
import { EncryptedVaultBlob, PaymentTokenRef } from '@irctc-tatkal/shared';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: UserRecord[];
  vaults: EncryptedVaultBlob[];
  paymentTokens: PaymentTokenRef[];
}

export class JsonDatabase {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(filePath?: string) {
    this.filePath = filePath || process.env.DATA_FILE || path.join(__dirname, '../../data/vault_db.json');
    this.data = {
      users: [],
      vaults: [],
      paymentTokens: []
    };
    this.init();
  }

  private init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.warn('[DB] Failed to read existing database file, creating fresh store.', err);
        this.save();
      }
    } else {
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to write database file:', err);
    }
  }

  // User Operations
  findUserByEmail(email: string): UserRecord | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  createUser(user: UserRecord): UserRecord {
    this.data.users.push(user);
    this.save();
    return user;
  }

  // Vault Blob Operations (Zero-Knowledge Ciphertext Only)
  getVaultBlobsByUserId(userId: string): EncryptedVaultBlob[] {
    return this.data.vaults.filter((v) => v.userId === userId);
  }

  getVaultBlobById(id: string, userId: string): EncryptedVaultBlob | undefined {
    return this.data.vaults.find((v) => v.id === id && v.userId === userId);
  }

  saveVaultBlob(blob: EncryptedVaultBlob): EncryptedVaultBlob {
    const existingIndex = this.data.vaults.findIndex((v) => v.id === blob.id && v.userId === blob.userId);
    if (existingIndex >= 0) {
      this.data.vaults[existingIndex] = blob;
    } else {
      this.data.vaults.push(blob);
    }
    this.save();
    return blob;
  }

  deleteVaultBlob(id: string, userId: string): boolean {
    const initialLen = this.data.vaults.length;
    this.data.vaults = this.data.vaults.filter((v) => !(v.id === id && v.userId === userId));
    const deleted = this.data.vaults.length < initialLen;
    if (deleted) this.save();
    return deleted;
  }

  // Payment Token Reference Operations (Opaque references only)
  getPaymentTokensByUserId(userId: string): PaymentTokenRef[] {
    return this.data.paymentTokens.filter((p) => p.userId === userId);
  }

  savePaymentToken(token: PaymentTokenRef): PaymentTokenRef {
    const index = this.data.paymentTokens.findIndex((p) => p.id === token.id && p.userId === token.userId);
    if (index >= 0) {
      this.data.paymentTokens[index] = token;
    } else {
      this.data.paymentTokens.push(token);
    }
    this.save();
    return token;
  }

  deletePaymentToken(id: string, userId: string): boolean {
    const initialLen = this.data.paymentTokens.length;
    this.data.paymentTokens = this.data.paymentTokens.filter((p) => !(p.id === id && p.userId === userId));
    const deleted = this.data.paymentTokens.length < initialLen;
    if (deleted) this.save();
    return deleted;
  }

  // Reset database for tests
  clearAll() {
    this.data = { users: [], vaults: [], paymentTokens: [] };
    this.save();
  }
}

export const db = new JsonDatabase();

