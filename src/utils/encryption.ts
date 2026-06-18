// src/utils/encryption.ts

const STORAGE_KEY = 'cloud_notes_encryption_key';
const PREV_STORAGE_KEY = 'cloud_notes_prev_encryption_key';

// Key derivation parameters
const PBKDF2_ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12; // AES-GCM recommendation

function safeAtob(str: string): string {
  if (!str) return "";
  const originalStr = str;
  let cleaned = str.replace(/[^A-Za-z0-9+/=]/g, '').trim();

  const pad = cleaned.length % 4;
  if (pad === 1) {
    cleaned = cleaned.slice(0, -1);
  } else if (pad === 2 || pad === 3) {
    cleaned += '='.repeat(4 - pad);
  }

  try {
    return atob(cleaned);
  } catch (e) {
    console.error("safeAtob failed on", originalStr.substring(0, 100));
    throw e;
  }
}

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
    const current = localStorage.getItem(STORAGE_KEY);
    if (current && current !== pass) {
      this.setPreviousPassword(current);
    }
    localStorage.setItem(STORAGE_KEY, pass);
  },

  getPreviousPassword(): string | null {
    return localStorage.getItem(PREV_STORAGE_KEY);
  },

  setPreviousPassword(pass: string) {
    localStorage.setItem(PREV_STORAGE_KEY, pass);
  },

  clearPreviousPassword() {
    localStorage.removeItem(PREV_STORAGE_KEY);
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
        // @ts-expect-error - TS gets confused with SharedArrayBuffer
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
  async encrypt(text: string, customPassword?: string): Promise<string> {
    if (!text) return '';
    const crypto = getCrypto();
    const password = customPassword || this.getOrInitPassword();

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
  async decrypt(encryptedText: string, customPassword?: string): Promise<string> {
    if (!encryptedText || !encryptedText.startsWith('ENC:v1:')) {
        return encryptedText; // Not encrypted or unknown version, return as is
    }

    const doDecrypt = async (pass: string) => {
        const crypto = getCrypto();
        const parts = encryptedText.split(':');
        if (parts.length < 5) throw new Error("Invalid format: " + encryptedText);
        if (parts[4].length === 0) throw new Error("Empty ciphertext: " + encryptedText);

        let salt, iv, ciphertext;
        try {
            salt = Uint8Array.from(safeAtob(parts[2]), c => c.charCodeAt(0));
            iv = Uint8Array.from(safeAtob(parts[3]), c => c.charCodeAt(0));
            ciphertext = Uint8Array.from(safeAtob(parts[4]), c => c.charCodeAt(0));
        } catch (e: any) { throw new Error("Invalid base64 encoding: " + e.message); }

        const key = await this.deriveKey(pass, salt);

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
    };

    try {
      const password = customPassword || this.getOrInitPassword();
      return await doDecrypt(password);
    } catch (e) {
      // If decryption fails, try the previous password as a fallback
      // This prevents locking users out if a key rotation was interrupted
      if (!customPassword) {
         const prevPassword = this.getPreviousPassword();
         if (prevPassword) {
             try {
                return await doDecrypt(prevPassword);
             } catch (fallbackError) {
                // Ignore fallback error, throw original
             }
         }
      }

      console.error("Decryption failed", e);
      return "**Decryption Failed**: Please check your encryption key.";
    }
  },

  async verifyPassword(password: string, sampleEncryptedText: string): Promise<boolean> {
     if (!sampleEncryptedText || !sampleEncryptedText.startsWith('ENC:v1:')) {
         return true; // Nothing to verify against
     }
     try {
         const decrypted = await this.decrypt(sampleEncryptedText, password);
         return !decrypted.startsWith("**Decryption Failed**");
     } catch (e) {
         return false;
     }
  }
};
