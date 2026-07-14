import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { KycProvider, KycVerificationResult } from './kyc-provider.interface';

/**
 * OpenAI Vision API implementation of the KycProvider.
 * Compares an identity document with a live face scan and checks document authenticity.
 */
@Injectable()
export class OpenAiKycProvider implements KycProvider {
  private readonly logger = new Logger(OpenAiKycProvider.name);
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY') || 'dummy_key_for_testing',
    });
  }

  /**
   * Evaluates identity document and face scan using GPT-4o Vision models.
   *
   * @param documentBuffer - Buffer containing the user-uploaded ID document image.
   * @param faceScanBuffer - Buffer containing the live selfie/face scan image.
   * @returns Detailed verification assessment.
   */
  async verify(
    documentBuffer: Buffer,
    faceScanBuffer: Buffer,
    documentMimeType?: string,
    faceScanMimeType?: string,
  ): Promise<KycVerificationResult> {
    this.logger.log('Executing OpenAI Vision KYC verification');

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'dummy_key_for_testing') {
      this.logger.warn('OpenAI API key not configured or dummy. Falling back to simulated verification.');
      return this.getFallbackResult();
    }

    try {
      const documentBase64 = documentBuffer.toString('base64');
      const faceScanBase64 = faceScanBuffer.toString('base64');

      const docMime = documentMimeType || this.detectMimeType(documentBuffer);
      const faceMime = faceScanMimeType || this.detectMimeType(faceScanBuffer);

      const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a secure, highly accurate KYC verification assistant for an Ethiopian freelance network. ' +
              'Always return verification responses in a strict JSON format.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'You are given two images:\n' +
                  'Image 1: User uploaded ID document (passport, national ID card, or driver\'s license).\n' +
                  'Image 2: User\'s live face scan (selfie).\n\n' +
                  'Please perform these checks:\n' +
                  '1. Verify if the ID document in Image 1 is authentic, valid, not expired, and contains clear details.\n' +
                  '2. Perform a face comparison: Does the face in the ID document (Image 1) match the face in the selfie (Image 2)?\n' +
                  '3. Perform a liveness check: Does Image 2 show a live person scan (no screens, paper printouts, or deepfakes)?\n' +
                  '4. Extract the full name and identification number from the document in Image 1.\n\n' +
                  'You MUST respond with a valid JSON object matching the following structure:\n' +
                  '{\n' +
                  '  "matchScore": <number between 0 and 100 representing facial match confidence>,\n' +
                  '  "livenessPassed": <boolean indicating if selfie liveness check succeeded>,\n' +
                  '  "isDocumentValid": <boolean indicating if ID document is authentic & readable>,\n' +
                  '  "extractedName": "<name on document or null>",\n' +
                  '  "extractedIdNumber": "<document number or null>",\n' +
                  '  "rejectionReason": "<short reason for rejection, or null if verification passed>"\n' +
                  '}',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${docMime};base64,${documentBase64}`,
                },
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${faceMime};base64,${faceScanBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(rawContent) as KycVerificationResult;

      return {
        matchScore: Math.min(100, Math.max(0, parsed.matchScore ?? 0)),
        livenessPassed: !!parsed.livenessPassed,
        isDocumentValid: !!parsed.isDocumentValid,
        extractedName: parsed.extractedName || undefined,
        extractedIdNumber: parsed.extractedIdNumber || undefined,
        rejectionReason: parsed.rejectionReason || undefined,
      };
    } catch (err) {
      this.logger.error(`OpenAI Vision call failed: ${(err as Error).message}`, (err as Error).stack);
      return {
        matchScore: 0,
        livenessPassed: false,
        isDocumentValid: false,
        rejectionReason: `AI processing failed: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Helper to detect file MIME type from buffer headers.
   */
  private detectMimeType(buffer: Buffer): string {
    if (buffer.length >= 4) {
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        return 'image/png';
      }
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
      }
      if (
        buffer[0] === 0x52 && // R
        buffer[1] === 0x49 && // I
        buffer[2] === 0x46 && // F
        buffer[3] === 0x46 && // F
        buffer.length >= 12 &&
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50 // P
      ) {
        return 'image/webp';
      }
      if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46
      ) {
        return 'image/gif';
      }
    }
    return 'image/jpeg'; // fallback default
  }

  /**
   * Generates a safe fallback response when API keys are not available.
   *
   * @returns Default failure verification result.
   */
  private getFallbackResult(): KycVerificationResult {
    return {
      matchScore: 0,
      livenessPassed: false,
      isDocumentValid: false,
      rejectionReason: 'KYC identity verification provider is unconfigured.',
    };
  }
}
