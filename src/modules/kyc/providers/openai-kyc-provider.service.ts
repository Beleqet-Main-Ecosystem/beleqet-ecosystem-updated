import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { KycProvider, KycVerificationInput, KycVerificationResult } from './kyc-provider.interface';

interface OpenAiKycResponseSchema {
  matchScore: number;
  livenessPassed: boolean | string;
  isDocumentValid: boolean | string;
  extractedName?: string | null;
  extractedIdNumber?: string | null;
  rejectionReason?: string | null;
}

/**
 * OpenAI-powered implementation of the {@link KycProvider} contract.
 *
 * This provider performs automated identity verification by analyzing:
 * - Government-issued identification documents.
 * - User-provided live selfie or face scan images.
 *
 * The verification process evaluates:
 * - Document authenticity and readability.
 * - Face similarity between document and selfie.
 * - Liveness indicators to reduce spoofing attempts.
 * - Extraction of identity information from the document.
 *
 * When OpenAI credentials are unavailable or an API failure occurs,
 * the provider returns a safe rejection result instead of allowing
 * unverifiable identities to pass validation.
 *
 * @implements {KycProvider}
 */
@Injectable()
export class OpenAiKycProvider implements KycProvider {
  /**
   * Internal logger used for audit and operational diagnostics.
   */
  private readonly logger = new Logger(OpenAiKycProvider.name);
  /**
   * OpenAI SDK client used for document and facial verification analysis.
   */
  private readonly openai: OpenAI;
  /**
   * Creates a new OpenAI KYC provider instance.
   *
   * Initializes the OpenAI SDK using the configured API key.
   *
   * @param config Application configuration service used to retrieve
   * environment variables and provider settings.
   */
  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY') || 'dummy_key_for_testing',
    });
  }

  /**
   * Performs automated identity verification using OpenAI Vision models.
   *
   * The method compares an uploaded identification document with a
   * live face scan and requests a structured verification assessment
   * from the configured OpenAI model.
   *
   * Verification includes:
   * - Face matching analysis.
   * - Liveness detection assessment.
   * - Document authenticity validation.
   * - Identity information extraction.
   *
   * If the provider is unavailable or an API error occurs,
   * a rejection result is returned.
   *
   * @param input Structured verification input containing document
   * and face scan image data.
   *
   * @returns Verification result containing:
   * - Match score.
   * - Liveness outcome.
   * - Document validity status.
   * - Extracted identity information.
   * - Rejection reason when applicable.
   */
  async verify(input: KycVerificationInput): Promise<KycVerificationResult> {
    const { documentBuffer, documentMimeType, faceScanBuffer, faceScanMimeType } = input;

    this.logger.log('Executing OpenAI Vision KYC verification payload pipeline.');

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'dummy_key_for_testing') {
      this.logger.warn('OpenAI API key not configured. Falling back to safe simulated rejection.');
      return this.getFallbackResult();
    }

    try {
      // Safely transform both modern Uint8Arrays and Node Buffers into clean base64 data streams
      const docUint8 =
        documentBuffer instanceof Uint8Array ? documentBuffer : new Uint8Array(documentBuffer);
      const faceUint8 =
        faceScanBuffer instanceof Uint8Array ? faceScanBuffer : new Uint8Array(faceScanBuffer);

      const documentBase64 = Buffer.from(docUint8).toString('base64');
      const faceScanBase64 = Buffer.from(faceUint8).toString('base64');

      // Use incoming verified mimeTypes from our interceptor fallback to headers guard
      const docMime = documentMimeType || this.detectMimeType(docUint8);
      const faceMime = faceScanMimeType || this.detectMimeType(faceUint8);

      const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a secure, highly accurate KYC verification assistant for an Ethiopian freelance network. ' +
              'Analyze the images provided and reply exclusively using a strict, valid JSON format matching the schema provided by the user. Do not return markdown wraps or extra descriptions.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Perform an absolute identity check based on these two images:\n' +
                  "Image 1: User uploaded ID document (passport, national ID card, or driver's license).\n" +
                  "Image 2: User's live face scan (selfie).\n\n" +
                  'Verification Tasks:\n' +
                  '1. Verify if the ID document in Image 1 is authentic, valid, unexpired, and clearly legible.\n' +
                  '2. Perform an explicit face comparison: Does the facial geometry in the ID match the selfie?\n' +
                  '3. Perform a liveness check: Ensure Image 2 is a genuine live person capture (no screens, paper copy printouts, or deepfakes).\n' +
                  '4. Extract full legal name and specific unique identification alphanumeric strings from Image 1.\n\n' +
                  'You MUST respond with a valid JSON object matching this structural blueprint:\n' +
                  '{\n' +
                  '  "matchScore": <number between 0 and 100>,\n' +
                  '  "livenessPassed": <boolean>,\n' +
                  '  "isDocumentValid": <boolean>,\n' +
                  '  "extractedName": "<string or null>",\n' +
                  '  "extractedIdNumber": "<string or null>",\n' +
                  '  "rejectionReason": "<string explaining failures, or null if fully approved>"\n' +
                  '}',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${docMime};base64,${documentBase64}` },
              },
              {
                type: 'image_url',
                image_url: { url: `data:${faceMime};base64,${faceScanBase64}` },
              },
            ],
          },
        ],
        temperature: 0.0, // Reduced to 0.0 for absolute deterministic consistency across identity evaluations
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0]?.message?.content ?? '{}';

      // Defensively parse incoming structural models against unexpected empty string or formatting edge-cases
      let parsed: OpenAiKycResponseSchema;
      try {
        parsed = JSON.parse(rawContent) as OpenAiKycResponseSchema;
      } catch (jsonErr) {
        throw new Error(
          'OpenAI returned corrupted non-JSON structure even under json_object configuration.',
        );
      }

      // Explicitly protect schema typing rules before mapping directly to database fields
      return {
        matchScore:
          typeof parsed.matchScore === 'number' ? Math.min(100, Math.max(0, parsed.matchScore)) : 0,
        livenessPassed: parsed.livenessPassed === true || parsed.livenessPassed === 'true',
        isDocumentValid: parsed.isDocumentValid === true || parsed.isDocumentValid === 'true',
        extractedName:
          parsed.extractedName && parsed.extractedName !== 'null'
            ? String(parsed.extractedName)
            : undefined,
        extractedIdNumber:
          parsed.extractedIdNumber && parsed.extractedIdNumber !== 'null'
            ? String(parsed.extractedIdNumber)
            : undefined,
        rejectionReason:
          parsed.rejectionReason && parsed.rejectionReason !== 'null'
            ? String(parsed.rejectionReason)
            : undefined,
      };
    } catch (err) {
      this.logger.error(
        `OpenAI Vision execution failure: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return {
        matchScore: 0,
        livenessPassed: false,
        isDocumentValid: false,
        rejectionReason: `AI engine execution exception: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Attempts to determine the MIME type of an image using file signatures.
   *
   * Supported formats:
   * - PNG
   * - JPEG
   * - WEBP
   * - GIF
   *
   * If no known signature is detected, JPEG is returned as the default.
   *
   * @param buffer Raw normalized Uint8Array image stream.
   *
   * @returns Detected MIME type.
   */
  private detectMimeType(buffer: Uint8Array): string {
    if (buffer.length >= 4) {
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
        return 'image/png';
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
      if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer.length >= 12 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      )
        return 'image/webp';
      if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
    }
    return 'image/jpeg';
  }

  /**
   * Creates a secure fallback verification result.
   *
   * Used when the OpenAI provider is unavailable, misconfigured,
   * or cannot process the verification request.
   *
   * The fallback response intentionally fails verification to prevent
   * unauthorized approvals when identity verification cannot be completed.
   *
   * @returns Rejected verification result.
   */
  private getFallbackResult(): KycVerificationResult {
    return {
      matchScore: 0,
      livenessPassed: false,
      isDocumentValid: false,
      rejectionReason: 'KYC identity verification provider is unconfigured or key is default.',
    };
  }
}
