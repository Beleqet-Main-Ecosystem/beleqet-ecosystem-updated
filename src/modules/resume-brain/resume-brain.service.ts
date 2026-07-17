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
import { AIExtractorService } from './ai-extractor.service';
import { AiBudgetService } from './ai-budget.service';
import { ResumeValidatorService } from './resume-validator.service';
import {
  ProfileMapperService,
  UserProfileUpdate,
} from './profile-mapper.service';
import { ExtractedResume } from './dto/extracted-resume.dto';

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

/** Upload metadata plus the AI-extracted structured profile (Phase 4-6). */
export interface ExtractedResumeResult extends UploadMetadata {
  /** Provider that produced the extraction, e.g. "groq". */
  provider: string;
  /** Full structured resume — drives the frontend CV-form autofill. */
  profile: ExtractedResume;
  /**
   * The same data mapped to the existing UsersService update shape (Phase 6).
   * The frontend can send this straight to `PATCH /users/profile` on Save.
   */
  userProfile: UserProfileUpdate;
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

  constructor(
    private readonly documentParser: DocumentParserService,
    private readonly aiExtractor: AIExtractorService,
    private readonly aiBudget: AiBudgetService,
    private readonly resumeValidator: ResumeValidatorService,
    private readonly profileMapper: ProfileMapperService,
  ) {}

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
   * Full pipeline: validate upload → parse text → AI-extract → validate (Phase 5).
   *
   * Reuses {@link parseResume} for the upload/parse stages, hands the raw text
   * to {@link AIExtractorService}, then runs the result through
   * {@link ResumeValidatorService} which rejects untrusted/empty AI output with
   * a `400`. The returned `profile` is a validated {@link ExtractedResume},
   * ready for the frontend autofill and (via the Phase 6 mapper) UserService.
   */
  async extractProfile(
    file?: UploadedResumeFile,
    userId?: string,
  ): Promise<ExtractedResumeResult> {
    const { text, ...metadata } = await this.parseResume(file);

    // Cost guard: reject (429) before spending on the paid provider if the user
    // is over their daily budget, then meter the tokens the call actually used.
    await this.aiBudget.assertWithinBudget(userId);
    const { resume: extracted, usage } = await this.aiExtractor.extract(text);
    await this.aiBudget.recordUsage(userId, usage);

    const profile = this.resumeValidator.validate(extracted);
    const userProfile = this.profileMapper.toUserProfile(profile);
    return {
      ...metadata,
      provider: this.aiExtractor.providerName,
      profile,
      userProfile,
    };
  }

  /**
   * Reject anything that is not a PDF / DOCX. Checks BOTH the MIME type AND
   * the file extension to prevent spoofing attacks where a malicious file has
   * a forged MIME type or a fake extension. Both must match the allowlist.
   */
  private assertSupportedType(file: UploadedResumeFile): void {
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const ext = path.extname(file.originalname || '').toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.includes(ext);

    if (!mimeOk || !extOk) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type "${file.mimetype || ext || 'unknown'}". ` +
          'Only PDF and DOCX resumes are allowed.',
      );
    }

    this.assertMagicNumber(file, ext);
  }

  /**
   * Defence in depth: verify the file's leading bytes match its declared type.
   * MIME/extension can be spoofed; the magic number cannot. Rejecting a mismatch
   * here fails fast with a clear `415` instead of a confusing `422` deep inside
   * the parser. Every allowed extension (.pdf, .docx) has a well-defined header,
   * so nothing passes upload validation without a content check.
   */
  private assertMagicNumber(file: UploadedResumeFile, ext: string): void {
    const buffer = file.buffer;
    // A real PDF/DOCX is never this small — skipping the check here would let a
    // tiny junk file pass upload only to fail in the parser with a vague 422.
    if (!buffer || buffer.length < 4) {
      throw new UnsupportedMediaTypeException(
        'File is too small to be a valid PDF or DOCX resume.',
      );
    }

    if (
      ext === '.pdf' &&
      buffer.toString('ascii', 0, 4) !== '%PDF'
    ) {
      throw new UnsupportedMediaTypeException(
        'File content does not match the PDF format.',
      );
    }

    // .docx is a ZIP container — every one starts with the "PK" local-file header.
    if (ext === '.docx' && buffer.toString('ascii', 0, 2) !== 'PK') {
      throw new UnsupportedMediaTypeException(
        'File content does not match the DOCX format.',
      );
    }
  }
}
