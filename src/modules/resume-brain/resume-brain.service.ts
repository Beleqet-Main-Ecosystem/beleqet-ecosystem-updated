import {
  Injectable,
  BadRequestException,
  UnsupportedMediaTypeException,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from './resume-brain.constants';
import { DocumentParserService } from './document-parser.service';

/**
 * Minimal shape of a Multer-uploaded file. Mirrors what
 * `@nestjs/platform-express` provides without pulling in the full
 * `Express.Multer.File` type surface.
 */
export interface UploadedResumeFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Metadata returned to the client after a successful upload (Phase 2). */
export interface UploadMetadata {
  filename: string;
  mimetype: string;
  size: number;
}

/** Upload metadata plus the plain text extracted from the document (Phase 3). */
export interface ParsedResume extends UploadMetadata {
  text: string;
}

/**
 * ResumeBrainService
 *
 * Orchestrator for the Resume Brain module. In later phases this service will
 * coordinate document parsing, AI extraction, validation and profile mapping.
 * For now it exposes a health check (Phase 1) and file-upload validation
 * (Phase 2). Parsing and AI are intentionally not implemented yet.
 */
@Injectable()
export class ResumeBrainService {
  private readonly logger = new Logger(ResumeBrainService.name);

  constructor(private readonly documentParser: DocumentParserService) {}

  health() {
    return {
      status: 'ok',
      module: 'Resume Brain',
    };
  }

  /**
   * Validate an uploaded resume and return its metadata.
   *
   * The 5 MB size limit is enforced upstream by the `FileInterceptor` (Multer),
   * which raises a `413 Payload Too Large` before this method runs. Here we
   * guard against a missing file (`400`) and an unsupported type (`415`).
   */
  describeUpload(file?: UploadedResumeFile): UploadMetadata {
    if (!file) {
      throw new BadRequestException('No file uploaded. Expected form field "file".');
    }

    this.assertSupportedType(file);

    // Never log the file contents — only non-sensitive metadata.
    this.logger.log(
      `Accepted resume upload: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
    );

    return {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Validate an uploaded resume and extract its plain text (Phase 3).
   *
   * Reuses {@link describeUpload} for the `400`/`415` guards, then delegates the
   * actual text extraction to {@link DocumentParserService}. Parsing failures
   * surface as `422 Unprocessable Entity`.
   */
  async parseResume(file?: UploadedResumeFile): Promise<ParsedResume> {
    const metadata = this.describeUpload(file);
    // `describeUpload` throws when `file` is missing, so it is defined here.
    const text = await this.documentParser.extractText(file as UploadedResumeFile);
    return { ...metadata, text };
  }

  /**
   * Reject anything that is not a PDF / DOC / DOCX. Checks the MIME type first
   * and falls back to the file extension for browsers/clients that send a
   * generic `application/octet-stream`.
   */
  private assertSupportedType(file: UploadedResumeFile): void {
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const ext = path.extname(file.originalname || '').toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.includes(ext);

    if (!mimeOk && !extOk) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type "${file.mimetype || ext || 'unknown'}". ` +
          'Only PDF, DOC, and DOCX resumes are allowed.',
      );
    }
  }
}
