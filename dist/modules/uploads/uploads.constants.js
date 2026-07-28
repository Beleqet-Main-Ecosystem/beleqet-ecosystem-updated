"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_TYPE_EXTENSIONS = exports.MAX_UPLOAD_FILE_SIZE_BYTES = exports.ALLOWED_MIME_TYPES = void 0;
exports.ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
exports.MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
exports.MIME_TYPE_EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};
//# sourceMappingURL=uploads.constants.js.map