import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { UploadedResumeFile } from './resume-brain.service';

/** Document formats the parser knows how to extract text from. */
type ParsableKind = 'pdf' | 'docx';

/**
 * DocumentParserService
 *
 * Phase 3 — turns an uploaded resume (PDF/DOCX) into plain UTF-8 text.
 *
 * Deliberately isolated from {@link ResumeBrainService}: it knows nothing about
 * HTTP, AI, or the database — it only converts bytes into text. Later phases
 * feed the returned text to the AI extractor.
 */
@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  /**
   * Extract plain text from an already-validated resume upload.
   *
   * @throws UnprocessableEntityException when the format cannot be parsed
   *   (e.g. legacy binary `.doc`), the file is corrupt or password-protected,
   *   or it contains no readable text (e.g. a scanned/image-only PDF).
   */
  async extractText(file: UploadedResumeFile): Promise<string> {
    const kind = this.detectKind(file);

    let rawText: string;
    try {
      rawText =
        kind === 'pdf'
          ? await this.parsePdf(file.buffer)
          : await this.parseDocx(file.buffer);
    } catch (err) {
      // Never log file contents — only the failure reason.
      this.logger.error(
        `Failed to extract text from ${kind} "${file.originalname}": ${
          (err as Error).message
        }`,
      );
      throw new UnprocessableEntityException(
        `Could not read the ${kind.toUpperCase()} file. ` +
          'It may be corrupted or password-protected.',
      );
    }

    const text = this.normalize(rawText);
    if (!text) {
      throw new UnprocessableEntityException(
        'No readable text found in the document. ' +
          'Scanned or image-only resumes are not supported.',
      );
    }

    this.logger.log(
      `Extracted ${text.length} characters from ${kind} "${file.originalname}".`,
    );
    return text;
  }

  /**
   * Choose the parser for this file. The upload validator already limits types
   * to pdf/doc/docx, but the legacy binary `.doc` format is not OOXML and cannot
   * be read by mammoth, so we reject it with a clear, actionable message rather
   * than letting it fail obscurely deeper in the pipeline.
   */
  private detectKind(file: UploadedResumeFile): ParsableKind {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = file.mimetype;

    if (mime === 'application/pdf' || ext === '.pdf') {
      return 'pdf';
    }
    if (
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      return 'docx';
    }

    // Legacy .doc (application/msword) or anything else that slipped through.
    throw new UnprocessableEntityException(
      'Legacy .doc files cannot be read. Please upload a PDF or DOCX resume.',
    );
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text ?? '';
    } finally {
      // Release the pdfjs worker/resources regardless of success.
      await parser.destroy();
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    const { value } = await mammoth.extractRawText({ buffer });
    return value ?? '';
  }

  /**
   * Tidy raw extracted text into clean, LLM-friendly plain text: strip the
   * "-- 1 of 3 --" page markers pdf-parse injects, normalise line endings, and
   * collapse trailing spaces and runs of blank lines.
   */
  private normalize(text: string): string {
    return text
      .replace(/^\s*-+\s*\d+\s+of\s+\d+\s*-+\s*$/gim, '') // pdf-parse page markers
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n') // trailing whitespace
      .replace(/\n{3,}/g, '\n\n') // collapse blank-line runs
      .trim();
  }
}
