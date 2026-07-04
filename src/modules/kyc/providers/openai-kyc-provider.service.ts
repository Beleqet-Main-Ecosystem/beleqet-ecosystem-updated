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
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
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
                  url: `data:image/jpeg;base64,${documentBase64}`,
                },
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${faceScanBase64}`,
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
