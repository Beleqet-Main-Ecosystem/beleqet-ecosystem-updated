/**
 * Minimal shape of a Multer-uploaded file used across the Resume Brain module.
 * Kept as a local interface (rather than depending on `@types/multer`) to
 * match the pattern already used by the KYC module (`KycUploadFile`).
 */
export interface ResumeUploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}
