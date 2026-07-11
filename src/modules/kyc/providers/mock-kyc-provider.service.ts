import { Injectable, Logger } from '@nestjs/common';
import { KycProvider, KycVerificationInput, KycVerificationResult } from './kyc-provider.interface';

/**
 * Mock implementation of the {@link KycProvider} contract.
 *
 * This provider is intended exclusively for:
 * - Local development.
 * - Automated testing.
 * - API integration validation.
 * - Frontend workflow development.
 *
 * No real biometric analysis is performed.
 * Verification results are generated deterministically based on
 * predefined conditions to simulate both successful and failed
 * identity verification scenarios.
 *
 * Supported test scenarios:
 * - Empty document uploads.
 * - Empty face scan uploads.
 * - Invalid document simulations.
 * - Successful verification simulations.
 *
 * @implements {KycProvider}
 */
@Injectable()
export class MockKycProvider implements KycProvider {
  /**
   * Internal logger used for development diagnostics and testing visibility.
   */
  private readonly logger = new Logger(MockKycProvider.name);

  /**
   * Simulates identity verification without invoking external services.
   *
   * The mock provider validates uploaded buffers and returns
   * predictable verification results for development and testing.
   *
   * Behavior:
   * - Empty document buffers return a failed verification result.
   * - Empty face scan buffers return a failed verification result.
   * - Document buffers smaller than 100 bytes simulate an invalid ID.
   * - All other requests simulate a successful verification.
   *
   * This deterministic behavior allows frontend and backend teams
   * to test approval, rejection, and error handling flows without
   * requiring a live KYC provider.
   *
   * @param input Structured verification input containing
   * document and face scan image data.
   *
   * @returns Simulated verification result.
   */
  async verify(input: KycVerificationInput): Promise<KycVerificationResult> {
    const { documentBuffer, faceScanBuffer } = input;

    this.logger.log('Executing simulated KYC verification pipelines (Mock Provider active).');

    // Safe extraction of buffer size supporting both legacy Node Buffers and modern Uint8Arrays
    const docSize = documentBuffer
      ? 'byteLength' in documentBuffer
        ? documentBuffer.byteLength
        : (documentBuffer as any).length
      : 0;
    const faceSize = faceScanBuffer
      ? 'byteLength' in faceScanBuffer
        ? faceScanBuffer.byteLength
        : (faceScanBuffer as any).length
      : 0;

    /**
     * Validate document payload integrity before continuing.
     * Empty buffers indicate missing or corrupted uploads.
     */
    if (!documentBuffer || docSize === 0) {
      return {
        matchScore: 0,
        livenessPassed: false,
        isDocumentValid: false,
        rejectionReason: 'Document image asset is empty or structurally corrupted.',
      };
    }
    /**
     * Validate face scan payload integrity before continuing.
     * Empty buffers indicate missing or corrupted uploads.
     */
    if (!faceScanBuffer || faceSize === 0) {
      return {
        matchScore: 0,
        livenessPassed: false,
        isDocumentValid: false,
        rejectionReason: 'Live face scan capture is empty or structurally corrupted.',
      };
    }

    /**
     * Special testing condition used to simulate verification failures.
     *
     * Uploading a very small document image intentionally triggers
     * a failed verification result, allowing clients to validate
     * rejection handling and error display workflows.
     */
    if (docSize < 100) {
      this.logger.warn(
        `Triggering programmable mock condition: Small document buffer (${docSize} bytes). Simulating failure.`,
      );
      return {
        matchScore: 34.2, // Low face match score
        livenessPassed: true,
        isDocumentValid: false, // Flagged invalid document
        rejectionReason:
          'The facial features on the document do not match the live face scan stream sufficiently.',
      };
    }

    /**
     * Default success scenario.
     *
     * Returns a simulated approved verification result containing
     * mock identity information for development purposes.
     */
    return {
      matchScore: 95.8,
      livenessPassed: true,
      isDocumentValid: true,
      extractedName: 'Bisrat Freelancer',
      extractedIdNumber: 'ET-ID-8849201A',
    };
  }
}
