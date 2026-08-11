import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { ParsedDocument, ResumeParser } from './resume-parser.interface';
import { PdfParserService } from './pdf-parser.service';
import { DocxParserService } from './docx-parser.service';

/**
 * Selects the correct format-specific parser for an uploaded CV and delegates
 * text extraction to it. This is the single entry point the rest of the
 * module should use instead of depending on individual parsers directly.
 */
@Injectable()
export class ResumeParsingService {
  private readonly parsers: ResumeParser[];

  constructor(pdfParser: PdfParserService, docxParser: DocxParserService) {
    this.parsers = [pdfParser, docxParser];
  }

  /**
   * Extracts plain text from an uploaded CV file.
   *
   * @param buffer - Raw bytes of the uploaded file.
   * @param mimeType - MIME type of the uploaded file.
   * @returns The extracted document text and OCR usage flag.
   */
  async parse(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
    const parser = this.parsers.find((candidate) => candidate.supports(mimeType));
    if (!parser) {
      throw new UnsupportedMediaTypeException(
        `No parser available for MIME type "${mimeType}". Supported formats: PDF, DOC, DOCX.`,
      );
    }
    return parser.parse(buffer);
  }
}
