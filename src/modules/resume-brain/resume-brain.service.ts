import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  RequestTimeoutException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ResumeUploadStatus } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';
import { ExtractedResumeDto } from './dto/extracted-resume.dto';
import { ResumeExtractionProvider } from './extraction/resume-extraction-provider.interface';
import { ResumeParsingService } from './parsers/resume-parsing.service';
import { ResumeUploadFile } from './resume-upload-file.interface';

/** MIME types accepted for CV uploads. */
export const RESUME_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Default maximum accepted upload size (10 MB), overridable via `RESUME_MAX_FILE_SIZE_MB`. */
const DEFAULT_MAX_FILE_SIZE_MB = 10;
/** Default timeout for the parse+extract pipeline, overridable via `RESUME_PARSE_TIMEOUT_MS`. */
const DEFAULT_PARSE_TIMEOUT_MS = 30_000;
/** Default locale used when a request does not resolve one. */
const DEFAULT_LANG = 'en';

/**
 * Orchestrates the Resume Brain pipeline: validating and storing an uploaded
 * CV, extracting structured data from it, persisting the result, retrieving
 * it, applying it to a professional's profile, and erasing it on request.
 * All client-facing error messages are translated via `nestjs-i18n`.
 */
@Injectable()
export class ResumeBrainService {
  private readonly logger = new Logger(ResumeBrainService.name);
  private readonly maxFileSizeBytes: number;
  private readonly maxFileSizeMb: number;
  private readonly parseTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly usersService: UsersService,
    private readonly parsingService: ResumeParsingService,
    @Inject('ResumeExtractionProvider')
    private readonly extractionProvider: ResumeExtractionProvider,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {
    this.maxFileSizeMb = this.config.get<number>(
      'RESUME_MAX_FILE_SIZE_MB',
      DEFAULT_MAX_FILE_SIZE_MB,
    );
    this.maxFileSizeBytes = this.maxFileSizeMb * 1024 * 1024;
    this.parseTimeoutMs = this.config.get<number>(
      'RESUME_PARSE_TIMEOUT_MS',
      DEFAULT_PARSE_TIMEOUT_MS,
    );
  }

  /**
   * Validates, stores, parses, and extracts structured data from an uploaded CV.
   *
   * @param userId - ID of the professional uploading the CV.
   * @param file - The uploaded file.
   * @param consentGiven - Explicit GDPR consent to process this CV's personal data.
   * @param lang - Resolved request locale, used to translate any error raised.
   * @returns The persisted upload record together with its parsed result.
   */
  async uploadAndProcess(
    userId: string,
    file: ResumeUploadFile,
    consentGiven: boolean,
    lang: string = DEFAULT_LANG,
  ) {
    this.validateFile(file, lang);
    const sanitizedFilename = this.sanitizeFilename(file.originalname);

    const stored = await this.uploadsService.uploadFile(
      { buffer: file.buffer, originalname: sanitizedFilename, mimetype: file.mimetype },
      'resumes',
    );

    const upload = await this.prisma.resumeUpload.create({
      data: {
        userId,
        originalFilename: sanitizedFilename,
        storageKey: stored.key,
        storageUrl: stored.publicUrl,
        mimeType: file.mimetype,
        fileSizeBytes: file.buffer.length,
        status: ResumeUploadStatus.PARSING,
        consentGiven,
        consentAt: new Date(),
      },
    });

    await this.logEvent('resume.uploaded', upload.id, 'ResumeUpload', {
      userId,
      mimeType: file.mimetype,
    });

    try {
      const extracted = await this.withTimeout(
        this.processDocument(file.buffer, file.mimetype, lang),
        this.parseTimeoutMs,
        lang,
      );

      const parsedResume = await this.prisma.$transaction(async (tx) => {
        const record = await tx.parsedResume.create({
          data: {
            resumeUploadId: upload.id,
            userId,
            personalInfo: extracted.personalInfo as unknown as Prisma.InputJsonValue,
            education: extracted.education as unknown as Prisma.InputJsonValue,
            workExperience: extracted.workExperience as unknown as Prisma.InputJsonValue,
            skills: extracted.skills,
            certifications: extracted.certifications,
            languages: extracted.languages as unknown as Prisma.InputJsonValue,
            extractionEngine: this.extractionProvider.engineId,
          },
        });
        await tx.resumeUpload.update({
          where: { id: upload.id },
          data: { status: ResumeUploadStatus.PARSED },
        });
        return record;
      });

      await this.logEvent('resume.parsed', upload.id, 'ResumeUpload', {
        userId,
        extractionEngine: this.extractionProvider.engineId,
      });

      return { upload: { ...upload, status: ResumeUploadStatus.PARSED }, parsedResume };
    } catch (err) {
      const reason = (err as Error).message;
      await this.prisma.resumeUpload.update({
        where: { id: upload.id },
        data: { status: ResumeUploadStatus.FAILED, failureReason: reason },
      });
      await this.logEvent('resume.parse_failed', upload.id, 'ResumeUpload', { userId, reason });
      throw err;
    }
  }

  /**
   * Retrieves a previously uploaded CV and its parsed result.
   *
   * @param userId - ID of the requesting professional (must own the resume).
   * @param id - `ResumeUpload` ID.
   * @param lang - Resolved request locale, used to translate any error raised.
   */
  async getResume(userId: string, id: string, lang: string = DEFAULT_LANG) {
    const upload = await this.prisma.resumeUpload.findUnique({
      where: { id },
      include: { parsedResume: true },
    });
    if (!upload) throw new NotFoundException(this.t('RESUME_NOT_FOUND', lang));
    if (upload.userId !== userId)
      throw new ForbiddenException(this.t('FORBIDDEN_RESUME_ACCESS', lang));
    return upload;
  }

  /**
   * Permanently erases a CV and its parsed data (GDPR right-to-erasure):
   * removes the stored file and cascades the database delete to the parsed
   * result.
   *
   * @param userId - ID of the requesting professional (must own the resume).
   * @param id - `ResumeUpload` ID.
   * @param lang - Resolved request locale, used to translate any error raised.
   */
  async deleteResume(userId: string, id: string, lang: string = DEFAULT_LANG): Promise<void> {
    const upload = await this.prisma.resumeUpload.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException(this.t('RESUME_NOT_FOUND', lang));
    if (upload.userId !== userId)
      throw new ForbiddenException(this.t('FORBIDDEN_RESUME_ACCESS', lang));

    await this.uploadsService.deleteFile(upload.storageKey).catch((err) => {
      this.logger.warn(`Failed to delete stored file for resume ${id}: ${(err as Error).message}`);
    });

    await this.prisma.resumeUpload.delete({ where: { id } });

    await this.logEvent('resume.deleted', id, 'ResumeUpload', { userId });
  }

  /**
   * Applies a parsed resume's personal details and skills to the
   * professional's profile via {@link UsersService}. When the caller supplies
   * `personalInfo`/`skills` overrides (e.g. after correcting the extracted
   * data in the review form), those take precedence over the originally
   * stored parsed values.
   *
   * @param userId - ID of the professional whose profile is being updated.
   * @param resumeId - `ParsedResume` ID to source data from (also used to verify ownership).
   * @param lang - Resolved request locale, used to translate any error raised.
   * @param overrides - Optional corrected personal info / skills from the review form.
   */
  async autofillProfile(
    userId: string,
    resumeId: string,
    lang: string = DEFAULT_LANG,
    overrides?: { personalInfo?: ExtractedResumeDto['personalInfo']; skills?: string[] },
  ) {
    const parsedResume = await this.prisma.parsedResume.findUnique({ where: { id: resumeId } });
    if (!parsedResume) throw new NotFoundException(this.t('PARSED_RESUME_NOT_FOUND', lang));
    if (parsedResume.userId !== userId) {
      throw new ForbiddenException(this.t('FORBIDDEN_PARSED_RESUME_ACCESS', lang));
    }

    const personalInfo =
      overrides?.personalInfo ??
      (parsedResume.personalInfo as unknown as ExtractedResumeDto['personalInfo']);
    const skills = overrides?.skills ?? parsedResume.skills;
    const [firstName, ...rest] = (personalInfo.fullName ?? '').trim().split(/\s+/).filter(Boolean);
    const lastName = rest.join(' ');

    const updatedUser = await this.usersService.update(userId, {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(personalInfo.phone ? { phone: personalInfo.phone } : {}),
      ...(personalInfo.location ? { location: personalInfo.location } : {}),
      ...(skills.length > 0 ? { skills } : {}),
    });

    await this.logEvent('profile.autofilled', userId, 'User', { userId, resumeId });

    return updatedUser;
  }

  /**
   * Runs the parse-then-extract pipeline and rejects empty results with a
   * meaningful error rather than persisting a blank record.
   */
  private async processDocument(
    buffer: Buffer,
    mimeType: string,
    lang: string,
  ): Promise<ExtractedResumeDto> {
    let text: string;
    try {
      ({ text } = await this.parsingService.parse(buffer, mimeType));
    } catch (err) {
      throw new BadRequestException(
        this.t('PARSE_FAILED', lang, { reason: (err as Error).message }),
      );
    }

    const extracted = await this.extractionProvider.extract(text);

    if (this.isEmptyExtraction(extracted)) {
      throw new BadRequestException(this.t('EMPTY_EXTRACTION', lang));
    }
    return extracted;
  }

  private isEmptyExtraction(data: ExtractedResumeDto): boolean {
    const hasPersonalInfo = Boolean(
      data.personalInfo?.fullName || data.personalInfo?.email || data.personalInfo?.phone,
    );
    return (
      !hasPersonalInfo &&
      data.education.length === 0 &&
      data.workExperience.length === 0 &&
      data.skills.length === 0 &&
      data.certifications.length === 0 &&
      data.languages.length === 0
    );
  }

  private validateFile(file: ResumeUploadFile | undefined | null, lang: string): void {
    if (!file) throw new BadRequestException(this.t('NO_FILE', lang));
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(this.t('EMPTY_FILE', lang));
    }
    if (!RESUME_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        this.t('UNSUPPORTED_FILE_TYPE', lang, { mimeType: file.mimetype }),
      );
    }
    if (file.buffer.length > this.maxFileSizeBytes) {
      throw new PayloadTooLargeException(
        this.t('FILE_TOO_LARGE', lang, { maxSizeMb: this.maxFileSizeMb }),
      );
    }
  }

  private sanitizeFilename(originalname: string): string {
    const base = path.basename(originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    return base.slice(-150) || 'resume';
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, lang: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new RequestTimeoutException(this.t('PARSE_TIMEOUT', lang))),
        ms,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private async logEvent(
    eventType: string,
    entityId: string,
    entityType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        eventType,
        entityId,
        entityType,
        payload: payload as unknown as Prisma.InputJsonValue,
        processedBy: ResumeBrainService.name,
      },
    });
  }

  private t(key: string, lang: string, args?: Record<string, unknown>): string {
    return this.i18n.t(`resume-brain.${key}`, { lang, args });
  }
}
