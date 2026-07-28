"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsController = exports.UploadFileDto = exports.PresignedUrlDto = exports.UPLOAD_FILE_INTERCEPTOR_OPTIONS = exports.MAX_UPLOAD_FILE_SIZE_BYTES = exports.ALLOWED_MIME_TYPES = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const fs = require("fs");
const path = require("path");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const uploads_service_1 = require("./uploads.service");
const uploads_constants_1 = require("./uploads.constants");
var uploads_constants_2 = require("./uploads.constants");
Object.defineProperty(exports, "ALLOWED_MIME_TYPES", { enumerable: true, get: function () { return uploads_constants_2.ALLOWED_MIME_TYPES; } });
Object.defineProperty(exports, "MAX_UPLOAD_FILE_SIZE_BYTES", { enumerable: true, get: function () { return uploads_constants_2.MAX_UPLOAD_FILE_SIZE_BYTES; } });
exports.UPLOAD_FILE_INTERCEPTOR_OPTIONS = {
    limits: {
        fileSize: uploads_constants_1.MAX_UPLOAD_FILE_SIZE_BYTES,
    },
    fileFilter: (_request, file, callback) => {
        if (!uploads_constants_1.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            callback(new common_1.BadRequestException('Invalid file type. Executables and HTML files are not allowed.'), false);
            return;
        }
        callback(null, true);
    },
};
class PresignedUrlDto {
}
exports.PresignedUrlDto = PresignedUrlDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Original file name from client', example: 'portfolio-banner.png' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PresignedUrlDto.prototype, "filename", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'MIME type of the uploaded file',
        enum: uploads_constants_1.ALLOWED_MIME_TYPES,
        example: 'image/png',
    }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsIn)(uploads_constants_1.ALLOWED_MIME_TYPES, {
        message: 'Invalid file type. Executables and HTML files are not allowed.',
    }),
    __metadata("design:type", String)
], PresignedUrlDto.prototype, "contentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'File size in bytes. Must not exceed the upload limit.',
        maximum: uploads_constants_1.MAX_UPLOAD_FILE_SIZE_BYTES,
        example: 524288,
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(uploads_constants_1.MAX_UPLOAD_FILE_SIZE_BYTES, {
        message: `File size must not exceed ${uploads_constants_1.MAX_UPLOAD_FILE_SIZE_BYTES} bytes.`,
    }),
    __metadata("design:type", Number)
], PresignedUrlDto.prototype, "fileSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        required: false,
        description: 'Destination folder in object storage',
        example: 'profiles',
    }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(128),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, {
        message: 'folder may only contain letters, numbers, dashes, underscores, and slashes',
    }),
    __metadata("design:type", String)
], PresignedUrlDto.prototype, "folder", void 0);
class UploadFileDto {
}
exports.UploadFileDto = UploadFileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Whether the user consented to file processing', example: 'true' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['true', 'false']),
    __metadata("design:type", String)
], UploadFileDto.prototype, "hasConsentedToProcessing", void 0);
let UploadsController = class UploadsController {
    constructor(uploadsService) {
        this.uploadsService = uploadsService;
    }
    async getPresignedUrl(body, user) {
        return this.uploadsService.generatePresignedUrl(body.filename, body.contentType, body.folder || 'misc', user.userId, body.fileSize);
    }
    async uploadFile(file, body, user) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded.');
        }
        const consent = body.hasConsentedToProcessing === 'true';
        return this.uploadsService.uploadFile(file, consent, user.userId);
    }
    async uploadFileAlias(file, body, user) {
        return this.uploadFile(file, body, user);
    }
    async getPresignedReadUrl(folder, filename) {
        return { url: await this.uploadsService.getPresignedReadUrl(`${folder}/${filename}`) };
    }
    async softDeleteFile(folder, filename, user) {
        return this.uploadsService.softDeleteFile(`${folder}/${filename}`, user.userId);
    }
    async getMyFiles(user) {
        return this.uploadsService.getMyFiles(user.userId);
    }
    async serveLocalFile(folder, filename, res) {
        if (!this.uploadsService.isLocalFallbackActive()) {
            throw new common_1.BadRequestException('Local file serving fallback is not active in this environment.');
        }
        const filePath = this.uploadsService.resolveLocalFilePath(`${folder}/${filename}`);
        if (!fs.existsSync(filePath)) {
            return res.status(common_1.HttpStatus.NOT_FOUND).json({ message: 'File not found on local disk' });
        }
        res.setHeader('Content-Type', this.resolveLocalContentType(filename));
        fs.createReadStream(filePath).pipe(res);
    }
    resolveLocalContentType(filename) {
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg')
            return 'image/jpeg';
        if (ext === '.png')
            return 'image/png';
        if (ext === '.webp')
            return 'image/webp';
        if (ext === '.pdf')
            return 'application/pdf';
        if (ext === '.doc')
            return 'application/msword';
        if (ext === '.docx')
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        return 'application/octet-stream';
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)('presigned-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a secure S3 upload URL for a file' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PresignedUrlDto, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getPresignedUrl", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a file securely' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                hasConsentedToProcessing: { type: 'string', example: 'true' },
            },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', exports.UPLOAD_FILE_INTERCEPTOR_OPTIONS)),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UploadFileDto, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Post)('file'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a file securely (alias)' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', exports.UPLOAD_FILE_INTERCEPTOR_OPTIONS)),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UploadFileDto, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "uploadFileAlias", null);
__decorate([
    (0, common_1.Get)('url/:folder/:filename'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a temporary read presigned URL for a stored file key' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('folder')),
    __param(1, (0, common_1.Param)('filename')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getPresignedReadUrl", null);
__decorate([
    (0, common_1.Delete)(':folder/:filename'),
    (0, swagger_1.ApiOperation)({ summary: 'GDPR Soft-delete and mask a file' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('folder')),
    __param(1, (0, common_1.Param)('filename')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "softDeleteFile", null);
__decorate([
    (0, common_1.Get)('my-files'),
    (0, swagger_1.ApiOperation)({ summary: 'List all files uploaded by the active authenticated user' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getMyFiles", null);
__decorate([
    (0, common_1.Get)('local-file/:folder/:filename'),
    (0, swagger_1.ApiOperation)({ summary: 'Serve local storage files (Development Fallback Only)' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('folder')),
    __param(1, (0, common_1.Param)('filename')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "serveLocalFile", null);
exports.UploadsController = UploadsController = __decorate([
    (0, swagger_1.ApiTags)('uploads'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('uploads'),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map