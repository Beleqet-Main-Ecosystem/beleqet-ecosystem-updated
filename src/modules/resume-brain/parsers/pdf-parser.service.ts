import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
// pdf-parse's types use `export =` (CommonJS) with no `.default`; import via
// `require` syntax to avoid relying on esModuleInterop, which this project does not enable.
import pdfParse = require('pdf-parse');
import { ParsedDocument, ResumeParser } from './resume-parser.interface';
import { OcrFallbackService } from './ocr-fallback.service';

/**
 * Extracts plain text from PDF resumes, falling back to OCR when the PDF has
 * no usable text layer (e.g. a scanned document saved as PDF).
 */
@Injectable()
export class PdfParserService implements ResumeParser {
  private static readonly MIN_TEXT_LENGTH = 40;
  private readonly logger = new Logger(PdfParserService.name);

  constructor(private readonly ocrFallback: OcrFallbackService) {}

  /** @inheritdoc */
  supports(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  /** @inheritdoc */
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    let extractedText: string;
    try {
      const result = await pdfParse(buffer);
      extractedText = (result.text ?? '').trim();
    } catch (err) {
      throw new UnprocessableEntityException(
        `Could not read the PDF file — it may be corrupted: ${(err as Error).message}`,
      );
    }

    if (extractedText.length >= PdfParserService.MIN_TEXT_LENGTH) {
      return { text: extractedText, usedOcrFallback: false };
    }

    this.logger.log('PDF text layer is empty or too short — attempting OCR fallback.');
    const ocrText = await this.ocrFallback.extractText(buffer, 'application/pdf');
    if (!ocrText.trim()) {
      throw new UnprocessableEntityException(
        'Unable to extract any text from the uploaded PDF, even with OCR.',
      );
    }
    return { text: ocrText, usedOcrFallback: true };
  }
}
