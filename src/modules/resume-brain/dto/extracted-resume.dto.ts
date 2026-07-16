import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ExtractedResume — the structured JSON contract the AI layer produces.
 *
 * This shape is deliberately a bridge between three consumers, so the same
 * object flows through the whole pipeline without translation surprises:
 *
 *  • DB      — `firstName`, `lastName`, `email`, `phone`, `summary` (→ User.bio),
 *              `headline`, `location`, `skills` map 1:1 onto columns of the
 *              existing `User` model (see prisma/schema.prisma).
 *  • Backend — the same fields line up with `UpdateUserDto`
 *              (src/modules/users/dto/update-user.dto.ts); the Phase 6
 *              ProfileMapper will do the final narrowing to that DTO.
 *  • Frontend — `education` / `experience` intentionally mirror the
 *              `Education` / `Experience` types used by the CV maker
 *              (beleqet-jobs-nextjs/app/cv-maker/page.tsx) so the autofill
 *              form can consume them as-is.
 *
 * The AI is instructed to return exactly this schema. `AIExtractorService`
 * normalises whatever comes back into this shape, so downstream code can rely
 * on every field being present and correctly typed.
 */

/** A single work-experience entry. Mirrors the frontend `Experience` type. */
export interface ExtractedExperience {
  role: string;
  company: string;
  /** Free-form start date as written on the resume, e.g. "Jan 2021". */
  start: string;
  /** Free-form end date, or "Present". */
  end: string;
  description: string;
}

/** A single education entry. Mirrors the frontend `Education` type. */
export interface ExtractedEducation {
  school: string;
  qualification: string;
  /** Free-form year or range, e.g. "2018 – 2022". */
  year: string;
}

/** The full structured resume the AI extracts from raw text. */
export interface ExtractedResume {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Professional summary. Maps to `User.bio`. */
  summary: string;
  /** Professional title / headline. Maps to `User.headline`. */
  headline: string;
  /** City / country. Maps to `User.location`. */
  location: string;
  skills: string[];
  languages: string[];
  certifications: string[];
  education: ExtractedEducation[];
  experience: ExtractedExperience[];
}

// ── Validation DTOs (Phase 5 — "never trust AI") ─────────────────────────────
//
// class-validator mirrors of the interfaces above. The extractor normalises the
// AI reply into these shapes; ResumeValidatorService then enforces these rules
// and rejects anything that slips through (bad email, over-long fields, etc.).
// Empty strings are allowed everywhere — a resume may simply omit a field — so
// validation guards *format*, not *presence*. Emptiness is handled separately.

/** Max entries we accept in any single list, to bound abuse / runaway output. */
const MAX_LIST = 100;

export class ExtractedEducationDto implements ExtractedEducation {
  @IsString() @MaxLength(200) school: string;
  @IsString() @MaxLength(200) qualification: string;
  @IsString() @MaxLength(100) year: string;
}

export class ExtractedExperienceDto implements ExtractedExperience {
  @IsString() @MaxLength(200) role: string;
  @IsString() @MaxLength(200) company: string;
  @IsString() @MaxLength(100) start: string;
  @IsString() @MaxLength(100) end: string;
  @IsString() @MaxLength(5000) description: string;
}

export class ExtractedResumeDto implements ExtractedResume {
  @IsString() @MaxLength(200) firstName: string;
  @IsString() @MaxLength(200) lastName: string;

  // Optional, but if the AI returns a non-empty email it MUST be well-formed.
  @IsString()
  @MaxLength(320)
  @ValidateIf((o: ExtractedResumeDto) => o.email !== '')
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @IsString() @MaxLength(100) phone: string;
  @IsString() @MaxLength(5000) summary: string;
  @IsString() @MaxLength(300) headline: string;
  @IsString() @MaxLength(300) location: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(MAX_LIST)
  skills: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(MAX_LIST)
  languages: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  @ArrayMaxSize(MAX_LIST)
  certifications: string[];

  @IsArray()
  @ArrayMaxSize(MAX_LIST)
  @ValidateNested({ each: true })
  @Type(() => ExtractedEducationDto)
  education: ExtractedEducationDto[];

  @IsArray()
  @ArrayMaxSize(MAX_LIST)
  @ValidateNested({ each: true })
  @Type(() => ExtractedExperienceDto)
  experience: ExtractedExperienceDto[];
}

/**
 * A fully-formed, empty ExtractedResume. Used as the normalisation baseline so
 * a missing AI field becomes an empty string / array rather than `undefined`.
 */
export const EMPTY_EXTRACTED_RESUME: ExtractedResume = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  summary: '',
  headline: '',
  location: '',
  skills: [],
  languages: [],
  certifications: [],
  education: [],
  experience: [],
};