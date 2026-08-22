/**
 * Client-Side Zero-Knowledge Cryptography Module
 * 
 * Uses Web Crypto API (AES-GCM-256 with PBKDF2 key derivation).
 * The server NEVER receives plaintext passenger details or derivation keys.
 */

// Cross-environment crypto helper (works in Browser, Service Worker, and Node.js)
const webCrypto = typeof globalThis !== 'undefined' && globalThis.crypto?.subtle
  ? globalThis.crypto
  : typeof window !== 'undefined' && window.crypto?.subtle
  ? window.crypto
  : require('crypto').webcrypto;

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

// Helper: Convert ArrayBuffer / Uint8Array to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 string to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an AES-GCM CryptoKey from a user passphrase and salt using PBKDF2.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await webCrypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return webCrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptionResult {
  ciphertext: string; // Base64
  iv: string;         // Base64
  salt: string;       // Base64
}

/**
 * Encrypt arbitrary JSON data with user master passphrase.
 */
export async function encryptData<T = any>(data: T, passphrase: string): Promise<EncryptionResult> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Master passphrase is required for encryption.');
  }

  const salt = new Uint8Array(16);
  webCrypto.getRandomValues(salt);

  const iv = new Uint8Array(12); // Standard 96-bit IV for AES-GCM
  webCrypto.getRandomValues(iv);

  const key = await deriveKey(passphrase, salt);
  const encoder = new TextEncoder();
  const serialized = JSON.stringify(data);
  const plaintextBytes = encoder.encode(serialized);

  const encryptedBuffer = await webCrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBytes
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt)
  };
}

/**
 * Decrypt ciphertext using user master passphrase.
 */
export async function decryptData<T = any>(
  encrypted: { ciphertext: string; iv: string; salt: string },
  passphrase: string
): Promise<T> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Master passphrase is required for decryption.');
  }

  const salt = base64ToBuffer(encrypted.salt);
  const iv = base64ToBuffer(encrypted.iv);
  const ciphertextBytes = base64ToBuffer(encrypted.ciphertext);

  const key = await deriveKey(passphrase, salt);

  try {
    const decryptedBuffer = await webCrypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertextBytes
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonString) as T;
  } catch (err) {
    throw new Error('Decryption failed. Invalid master passphrase or corrupted ciphertext.');
  }
}

/**
 * Generate a fast SHA-256 one-way hash for session telemetry anonymization.
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await webCrypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

