/**
 * Input payload used by KYC providers when performing
 * document validation and face matching verification.
 *
 * Using a structured object instead of positional parameters
 * improves readability and reduces the risk of argument ordering errors.
 */
export interface KycVerificationInput {
  /**
   * Identity document image buffer.
   */
  documentBuffer: Buffer | Uint8Array;

  /**
   * MIME type of the identity document image.
   *
   * Example: image/jpeg
   */
  documentMimeType: string;

  /**
   * Selfie or liveness capture image buffer.
   */
  faceScanBuffer: Buffer | Uint8Array;

  /**
   * MIME type of the selfie image.
   *
   * Example: image/png
   */
  faceScanMimeType: string;
}

/**
 * Result returned by a KYC verification provider.
 *
 * Contains document authenticity checks, liveness verification,
 * and facial similarity analysis results.
 */
export interface KycVerificationResult {
  /**
   * Face similarity score expressed as a percentage (0-100).
   */
  matchScore: number;

  /**
   * Indicates whether liveness verification succeeded.
   */
  livenessPassed: boolean;

  /**
   * Indicates whether the submitted document appears authentic.
   */
  isDocumentValid: boolean;

  /**
   * Name extracted from the identity document, if available.
   */
  extractedName?: string;

  /**
   * Document identifier extracted from the identity document, if available.
   */
  extractedIdNumber?: string;

  /**
   * Human-readable explanation describing the verification failure.
   */
  rejectionReason?: string;
}

/**
 * Contract implemented by KYC verification providers.
 *
 * Implementations may use third-party services or internal
 * verification engines to perform:
 * - Document authenticity checks
 * - Facial similarity matching
 * - Liveness detection
 *
 * Examples:
 * - OpenAI Vision
 * - AWS Rekognition
 * - Smile Identity
 * - Mock providers used during testing
 */
export interface KycProvider {
  /**
   * Performs identity verification using a document image
   * and a selfie or liveness capture.
   *
   * @param input Verification assets and metadata.
   *
   * @returns Structured verification results.
   */
  verify(input: KycVerificationInput): Promise<KycVerificationResult>;
}
