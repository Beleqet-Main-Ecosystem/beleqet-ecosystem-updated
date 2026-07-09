/**
 * crypto.ts — Client-side E2EE utilities for Secure Tunnel
 *
 * Uses the native Web Crypto API (window.crypto.subtle) — no external dependencies.
 * Private keys are stored in the browser's IndexedDB and never leave the device.
 *
 * Protocol:
 *   - Key exchange: ECDH (P-256 curve)
 *   - Symmetric encryption: AES-GCM (256-bit, 12-byte IV)
 *   - Key derivation: HKDF with SHA-256
 *
 * GDPR compliance:
 *   - The server stores only ciphertext + IV. It cannot decrypt messages.
 *   - Private keys remain in the user's browser only.
 */

const DB_NAME = 'beleqet_e2ee_keys';
const STORE_NAME = 'keyPairs';
const KEY_RECORD_ID = 'localKeyPair';

/** Opens (or creates) the IndexedDB for local key storage */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

/** Saves a CryptoKeyPair to IndexedDB */
async function saveKeyPair(keyPair: CryptoKeyPair): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(keyPair, KEY_RECORD_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieves the stored CryptoKeyPair from IndexedDB, or null if not found */
async function loadKeyPair(): Promise<CryptoKeyPair | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY_RECORD_ID);
    req.onsuccess = () => resolve((req.result as CryptoKeyPair) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Returns the user's ECDH key pair.
 * Generates and persists a new one if it doesn't exist yet.
 */
export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  const existing = await loadKeyPair();
  if (existing) return existing;

  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // Private key is NOT extractable — stays locked in the browser
    ['deriveKey']
  );

  await saveKeyPair(keyPair);
  return keyPair;
}

/**
 * Exports the user's public key as a Base64 string suitable for upload to the server.
 * @param publicKey The CryptoKey to export
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/**
 * Imports a recipient's Base64-encoded public key from the server.
 * @param base64Key Base64 public key string
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

/**
 * Derives a shared AES-GCM-256 key using our private key + recipient's public key.
 * Both parties derive the same key independently (ECDH).
 * @param privateKey  Our private CryptoKey
 * @param recipientPub Recipient's imported public CryptoKey
 */
export async function deriveSharedKey(
  privateKey: CryptoKey,
  recipientPub: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: recipientPub },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using AES-GCM with a fresh random IV.
 * @param sharedKey The derived symmetric key
 * @param plaintext The message to encrypt
 * @returns `{ ciphertext: string (Base64), iv: string (hex) }`
 */
export async function encryptMessage(
  sharedKey: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    sharedKey,
    encoded
  );

  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  const iv = Array.from(ivBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  return { ciphertext, iv };
}

/**
 * Decrypts a Base64 ciphertext using AES-GCM.
 * @param sharedKey The derived symmetric key
 * @param ciphertext Base64-encoded ciphertext
 * @param ivHex      Hex-encoded initialization vector
 * @returns Decrypted plaintext string
 */
export async function decryptMessage(
  sharedKey: CryptoKey,
  ciphertext: string,
  ivHex: string
): Promise<string> {
  const ivBytes = new Uint8Array(ivHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const cipherBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    sharedKey,
    cipherBytes
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Deletes the stored local key pair from IndexedDB (GDPR Right to Erasure / Reset).
 */
export async function deleteKeyPair(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(KEY_RECORD_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Computes a visual SHA-256 fingerprint of two public keys (similar to Signal safety numbers).
 */
export async function computeFingerprint(pub1: string, pub2: string): Promise<string> {
  const sorted = [pub1, pub2].sort().join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(sorted);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  const numbers: string[] = [];
  for (let i = 0; i < hashArray.length && numbers.length < 5; i += 2) {
    const val = (hashArray[i] << 8) + hashArray[i+1];
    numbers.push((val % 10000).toString().padStart(4, '0'));
  }
  return numbers.join('-');
}
