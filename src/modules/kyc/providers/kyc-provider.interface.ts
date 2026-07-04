/**
 * Result structure returned by KYC ID verification providers.
 */
export interface KycVerificationResult {
  /** Face match similarity score (0 to 100) */
  matchScore: number;
  /** True if the liveness detection check passed */
  livenessPassed: boolean;
  /** True if the document was determined to be valid and authentic */
  isDocumentValid: boolean;
  /** Extracted professional name from the ID document (optional) */
  extractedName?: string;
  /** Extracted document identification number (optional) */
  extractedIdNumber?: string;
  /** Rejection reason explaining any validation failures */
  rejectionReason?: string;
}

/**
 * Interface definition for KYC ID matching and liveness checking providers.
 */
export interface KycProvider {
  /**
   * Performs face matching and identity document validation.
   *
   * @param documentBuffer - Buffer containing the user-uploaded ID document image.
   * @param faceScanBuffer - Buffer containing the live selfie/face scan image.
   * @returns A promise resolving to the verification result details.
   */
  verify(
    documentBuffer: Buffer,
    faceScanBuffer: Buffer,
  ): Promise<KycVerificationResult>;
}
