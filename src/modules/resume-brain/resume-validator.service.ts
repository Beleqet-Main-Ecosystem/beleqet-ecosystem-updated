import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import {
  ExtractedResume,
  ExtractedResumeDto,
} from './dto/extracted-resume.dto';

/**
 * ResumeValidatorService
 *
 * Phase 5 — the "never trust AI" gate. Sits between the AI extractor and the
 * profile mapper: it takes the extractor's structured output and either returns
 * a validated {@link ExtractedResume} or rejects it with `400 Bad Request`.
 *
 * Two independent checks:
 *  1. Schema — {@link ExtractedResumeDto} (types, email format, field lengths,
 *     nested education/experience). Rejects malformed data.
 *  2. Substance — a resume with no usable content at all (the AI returned
 *     something that isn't really a resume, e.g. "hello world") is rejected so
 *     we never autofill a profile with nothing.
 */
@Injectable()
export class ResumeValidatorService {
  private readonly logger = new Logger(ResumeValidatorService.name);

  /**
   * Validate an extracted resume.
   *
   * @throws BadRequestException (400) when the data fails schema validation or
   *   contains no usable profile information.
   */
  validate(input: unknown): ExtractedResume {
    const dto = plainToInstance(ExtractedResumeDto, input ?? {});

    const errors = validateSync(dto, {
      whitelist: true,
      forbidUnknownValues: false,
    });

    if (errors.length > 0) {
      const messages = this.flatten(errors);
      this.logger.warn(`Extracted resume failed validation: ${messages.join('; ')}`);
      throw new BadRequestException({
        message: 'The extracted resume failed validation.',
        errors: messages,
      });
    }

    if (this.isEmpty(dto)) {
      this.logger.warn('Extracted resume contained no usable profile data.');
      throw new BadRequestException(
        'Could not extract a usable profile from this document. ' +
          'Please check that the file is a real resume.',
      );
    }

    return dto;
  }

  /** True when every field is empty — nothing worth autofilling. */
  private isEmpty(r: ExtractedResumeDto): boolean {
    return (
      !r.firstName &&
      !r.lastName &&
      !r.email &&
      !r.phone &&
      !r.summary &&
      !r.headline &&
      !r.location &&
      (r.skills?.length ?? 0) === 0 &&
      (r.languages?.length ?? 0) === 0 &&
      (r.certifications?.length ?? 0) === 0 &&
      (r.education?.length ?? 0) === 0 &&
      (r.experience?.length ?? 0) === 0
    );
  }

  /** Flatten nested class-validator errors into a flat list of messages. */
  private flatten(errors: ValidationError[], parent = ''): string[] {
    const out: string[] = [];
    for (const err of errors) {
      const path = parent ? `${parent}.${err.property}` : err.property;
      if (err.constraints) {
        for (const msg of Object.values(err.constraints)) {
          out.push(`${path}: ${msg}`);
        }
      }
      if (err.children?.length) {
        out.push(...this.flatten(err.children, path));
      }
    }
    return out;
  }
}
