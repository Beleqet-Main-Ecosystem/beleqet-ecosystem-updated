import { deriveSharedKey, encryptMessage, decryptMessage } from '../crypto';

describe('Secure Tunnel E2EE Crypto', () => {
  let aliceKeyPair: CryptoKeyPair;
  let bobKeyPair: CryptoKeyPair;
  let aliceSharedKey: CryptoKey;
  let bobSharedKey: CryptoKey;

  beforeAll(async () => {
    // Generate ECDH keys for Alice and Bob
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

  it('should encrypt and decrypt a message successfully', async () => {
    const plainText = 'Hello Bob, this is a secret message!';

    // Alice encrypts the message
    const { ciphertext, iv } = await encryptMessage(aliceSharedKey, plainText);

    expect(ciphertext).toBeDefined();
    expect(typeof ciphertext).toBe('string');
    expect(iv).toBeDefined();
    expect(typeof iv).toBe('string');
    expect(ciphertext).not.toContain(plainText);

    // Bob decrypts the message
    const decryptedText = await decryptMessage(bobSharedKey, ciphertext, iv);
    expect(decryptedText).toBe(plainText);
  });

  it('should fail to decrypt if using the wrong shared key', async () => {
    const plainText = 'Top secret data';
    const { ciphertext, iv } = await encryptMessage(aliceSharedKey, plainText);

    // Charlie generates their own keys
    const charlieKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    const charlieSharedKey = await deriveSharedKey(charlieKeyPair.privateKey, bobKeyPair.publicKey);

    // Charlie attempts to decrypt Alice's message meant for Bob
    await expect(decryptMessage(charlieSharedKey, ciphertext, iv)).rejects.toThrow();
  });
});
