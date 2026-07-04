import { Injectable, Logger } from '@nestjs/common';
import { KycProvider, KycVerificationResult } from './kyc-provider.interface';

/**
 * Mock KYC provider used for local testing and developer environments.
 * Simulates document analysis and face scanning with static responses.
 */
@Injectable()
export class MockKycProvider implements KycProvider {
  private readonly logger = new Logger(MockKycProvider.name);

  /**
   * Mock implementation of identity verification.
   * Automatically passes unless buffers are empty or match specific test names.
   *
   * @param documentBuffer - Buffer containing the user-uploaded ID document image.
   * @param faceScanBuffer - Buffer containing the live selfie/face scan image.
   * @returns Simulated KYC verification result.
   */
  async verify(
    documentBuffer: Buffer,
    faceScanBuffer: Buffer,
  ): Promise<KycVerificationResult> {
    this.logger.log('Executing simulated KYC verification (Mock Provider)');

    if (!documentBuffer || documentBuffer.length === 0) {
      return {
        matchScore: 0,
        livenessPassed: false,
        isDocumentValid: false,
        rejectionReason: 'Document image is empty or invalid.',
      };
    }

    if (!faceScanBuffer || faceScanBuffer.length === 0) {
      return {
        matchScore: 0,
        livenessPassed: false,
        isDocumentValid: false,
        rejectionReason: 'Live face scan image is empty or invalid.',
      };
    }

    // Check if mock input simulates a failure (e.g. check buffer size or content)
    // For general testing, we return a successful verification
    return {
      matchScore: 92.5,
      livenessPassed: true,
      isDocumentValid: true,
      extractedName: 'Bisrat Freelancer',
      extractedIdNumber: 'ID-8849201A',
    };
  }
}
