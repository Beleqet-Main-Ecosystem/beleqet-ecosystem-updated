import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { ParsedDocument, ResumeParser } from './resume-parser.interface';

/** MIME type used by modern `.docx` files. */
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** MIME type used by legacy `.doc` files. */
const DOC_MIME = 'application/msword';

/**
 * Extracts plain text from Word resumes using mammoth.
 *
 * Note: mammoth only understands the modern `.docx` (Office Open XML) format.
 * Legacy binary `.doc` files are accepted at the upload boundary but will fail
 * here with a clear error asking the professional to re-save as `.docx` or PDF.
 */
@Injectable()
export class DocxParserService implements ResumeParser {
  /** @inheritdoc */
  supports(mimeType: string): boolean {
    return mimeType === DOCX_MIME || mimeType === DOC_MIME;
  }

  /** @inheritdoc */
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = (value ?? '').trim();
      if (!text) {
        throw new Error('Document contains no extractable text.');
      }
      return { text, usedOcrFallback: false };
    } catch (err) {
      throw new UnprocessableEntityException(
        `Could not read the Word document. If this is a legacy .doc file, please re-save it as .docx or PDF. (${(err as Error).message})`,
      );
    }
  }
}
