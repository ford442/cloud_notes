// src/utils/encryption.ts

const STORAGE_KEY = 'cloud_notes_encryption_key';

// Key derivation parameters
const PBKDF2_ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12; // AES-GCM recommendation

// Helper to access crypto in both Browser and Node (for testing)
const getCrypto = () => {
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto;
  throw new Error("Crypto API not available");
};

export const EncryptionService = {
  // Get or create the master key (stored in localStorage for now)
  getOrInitPassword(): string {
    let pass = localStorage.getItem(STORAGE_KEY);
    if (!pass) {
      pass = this.generateRandomPassword();
      localStorage.setItem(STORAGE_KEY, pass);
    }
    return pass;
  },

  setPassword(pass: string) {
    localStorage.setItem(STORAGE_KEY, pass);
  },

  generateRandomPassword(): string {
    const crypto = getCrypto();
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  },

  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const crypto = getCrypto();
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  // Encrypt string
  async encrypt(text: string): Promise<string> {
    if (!text) return '';
    const crypto = getCrypto();
    const password = this.getOrInitPassword();

    const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
    const key = await this.deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
    const enc = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      enc.encode(text)
    );

    // Pack salt + iv + ciphertext as base64
    // Format: "ENC:v1:salt:iv:ciphertext"
    const buffer = new Uint8Array(encrypted);

    // Helper to encode
    const toBase64 = (arr: Uint8Array) => btoa(String.fromCharCode(...arr));

    return `ENC:v1:${toBase64(salt)}:${toBase64(iv)}:${toBase64(buffer)}`;
  },

  // Decrypt string
  async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText || !encryptedText.startsWith('ENC:v1:')) {
        return encryptedText; // Not encrypted or unknown version, return as is
    }

    try {
      const crypto = getCrypto();
      const password = this.getOrInitPassword();
      const parts = encryptedText.split(':');
      if (parts.length !== 5) throw new Error("Invalid format");

      const salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(parts[3]), c => c.charCodeAt(0));
      const ciphertext = Uint8Array.from(atob(parts[4]), c => c.charCodeAt(0));

      const key = await this.deriveKey(password, salt);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv
        },
        key,
        ciphertext
      );

      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (e) {
      console.error("Decryption failed", e);
      return "**Decryption Failed**: Please check your encryption key.";
    }
  }
};
