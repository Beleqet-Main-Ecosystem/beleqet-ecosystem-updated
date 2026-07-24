import { deriveSharedKey, encryptMessage, decryptMessage } from './crypto';

describe('Secure Tunnel E2EE Crypto primitives', () => {
  let aliceKeyPair: CryptoKeyPair;
  let bobKeyPair: CryptoKeyPair;
  let aliceSharedKey: CryptoKey;
  let bobSharedKey: CryptoKey;

  beforeAll(async () => {
    // Generate ECDH keys for Alice and Bob using Web Crypto
    aliceKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    bobKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );

    // Derive shared keys
    aliceSharedKey = await deriveSharedKey(aliceKeyPair.privateKey, bobKeyPair.publicKey);
    bobSharedKey = await deriveSharedKey(bobKeyPair.privateKey, aliceKeyPair.publicKey);
  });

  it('should encrypt plaintext on client and decrypt successfully with matching shared key', async () => {
    const plainText = 'Hello Bob, this is an end-to-end encrypted secret message!';

    // Alice encrypts
    const { ciphertext, iv } = await encryptMessage(aliceSharedKey, plainText);

    expect(ciphertext).toBeDefined();
    expect(typeof ciphertext).toBe('string');
    expect(iv).toBeDefined();
    expect(typeof iv).toBe('string');
    // Ensure plaintext is never exposed in ciphertext string
    expect(ciphertext).not.toContain(plainText);

    // Bob decrypts
    const decryptedText = await decryptMessage(bobSharedKey, ciphertext, iv);
    expect(decryptedText).toBe(plainText);
  });

  it('should fail decryption if using an incorrect shared key (unauthorized access)', async () => {
    const plainText = 'Top secret data';
    const { ciphertext, iv } = await encryptMessage(aliceSharedKey, plainText);

    // Charlie generates an unauthorized keypair
    const charlieKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    const charlieSharedKey = await deriveSharedKey(charlieKeyPair.privateKey, bobKeyPair.publicKey);

    // Charlie attempts to decrypt message intended for Bob
    await expect(decryptMessage(charlieSharedKey, ciphertext, iv)).rejects.toThrow();
  });
});
