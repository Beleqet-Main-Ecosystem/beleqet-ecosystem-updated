export declare const ALLOWED_MIME_TYPES: readonly ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export declare const MAX_UPLOAD_FILE_SIZE_BYTES: number;
export declare const MIME_TYPE_EXTENSIONS: Record<AllowedMimeType, string>;
