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
var UploadsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const fs_1 = require("fs");
const path = require("path");
const sharp_1 = require("sharp");
const uuid_1 = require("uuid");
const prisma_service_1 = require("../../prisma/prisma.service");
const uploads_constants_1 = require("./uploads.constants");
let UploadsService = UploadsService_1 = class UploadsService {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.s3Client = null;
        this.useLocalFallback = false;
        this.logger = new common_1.Logger(UploadsService_1.name);
        this.bucket =
            this.config.get('R2_BUCKET_NAME') ??
                this.config.get('AWS_S3_BUCKET', 'beleqet-uploads');
        this.localStoreDir = this.config.get('UPLOAD_LOCAL_DIR', path.join(process.cwd(), 'temp-storage'));
        this.immutableCacheControl = this.config.get('CDN_CACHE_CONTROL', 'public, max-age=31536000, immutable');
        const region = this.config.get('AWS_REGION', 'us-east-1');
        const accessKeyId = this.config.get('R2_ACCESS_KEY_ID') ?? this.config.get('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.config.get('R2_SECRET_ACCESS_KEY') ??
            this.config.get('AWS_SECRET_ACCESS_KEY');
        const endpoint = this.config.get('AWS_ENDPOINT') ??
            (this.config.get('R2_ACCOUNT_ID')
                ? `https://${this.config.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`
                : undefined);
        const hasValidCredentials = accessKeyId &&
            accessKeyId !== 'your_access_key' &&
            secretAccessKey &&
            secretAccessKey !== 'your_secret_key';
        if (hasValidCredentials) {
            this.s3Client = new client_s3_1.S3Client({
                region,
                ...(endpoint && { endpoint }),
                credentials: { accessKeyId, secretAccessKey },
            });
            this.logger.log('S3/R2 Storage client initialized successfully.');
        }
        else {
            this.useLocalFallback = true;
            this.logger.warn(`AWS/R2 credentials are missing or default. Falling back to local disk storage at: ${this.localStoreDir}`);
            void fs_1.promises.mkdir(this.localStoreDir, { recursive: true }).catch((error) => {
                this.logger.error(`Failed to initialize local upload directory: ${error.message}`);
            });
        }
    }
    isLocalFallbackActive() {
        return this.useLocalFallback;
    }
    getLocalStoreDir() {
        return this.localStoreDir;
    }
    async generatePresignedUrl(filename, contentType, folder = 'misc', userId, fileSize = 0) {
        this.assertAllowedMimeType(contentType);
        this.assertFileSize(fileSize || 1);
        const targetFolder = this.validateStorageFolder(folder);
        const extension = this.resolveSafeExtension(contentType);
        const key = `${targetFolder}/${(0, uuid_1.v4)()}${extension}`;
        let presignedUrl;
        if (this.useLocalFallback) {
            presignedUrl = this.buildLocalUrl(key);
        }
        else {
            if (!this.s3Client) {
                throw new common_1.InternalServerErrorException('Cloud storage client not initialized');
            }
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                ContentType: contentType,
                CacheControl: this.immutableCacheControl,
            });
            presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn: 900 });
        }
        await this.prisma.storedFile.create({
            data: {
                key,
                filename: this.sanitizeFilename(filename),
                mimeType: contentType,
                size: fileSize,
                hasConsentedToProcessing: true,
                uploadedById: userId || null,
            },
        });
        return {
            presignedUrl,
            publicUrl: this.buildPublicUrl(key),
            key,
            cacheControl: this.immutableCacheControl,
        };
    }
    async uploadFile(file, folderOrConsent = 'misc', userId) {
        const { folder, hasConsentedToProcessing } = this.resolveUploadTarget(folderOrConsent, file?.mimetype);
        if (!hasConsentedToProcessing) {
            throw new common_1.BadRequestException('GDPR data processing consent is mandatory to upload files.');
        }
        this.assertUploadableFile(file);
        const targetFolder = this.validateStorageFolder(folder);
        const optimizedAsset = await this.optimizeAsset(file);
        const key = `${targetFolder}/${(0, uuid_1.v4)()}${optimizedAsset.extension}`;
        try {
            if (this.useLocalFallback) {
                const localPath = this.resolveLocalFilePath(key);
                await fs_1.promises.mkdir(path.dirname(localPath), { recursive: true });
                await fs_1.promises.writeFile(localPath, optimizedAsset.buffer);
                this.logger.debug(`File written locally to: ${localPath}`);
            }
            else {
                if (!this.s3Client) {
                    throw new common_1.InternalServerErrorException('Cloud storage client not initialized');
                }
                const command = new client_s3_1.PutObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                    Body: optimizedAsset.buffer,
                    ContentType: optimizedAsset.contentType,
                    CacheControl: this.immutableCacheControl,
                });
                await this.s3Client.send(command);
                this.logger.debug(`File uploaded to S3: ${key}`);
            }
            const storedFile = await this.prisma.storedFile.create({
                data: {
                    key,
                    filename: this.sanitizeFilename(file.originalname),
                    mimeType: optimizedAsset.contentType,
                    size: optimizedAsset.buffer.length,
                    hasConsentedToProcessing,
                    uploadedById: userId || null,
                },
            });
            return {
                ...storedFile,
                publicUrl: this.buildPublicUrl(key),
                cacheControl: this.immutableCacheControl,
                contentType: optimizedAsset.contentType,
                optimized: optimizedAsset.optimized,
            };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException || error instanceof common_1.InternalServerErrorException) {
                throw error;
            }
            this.logger.error(`Upload error details: ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Failed to process and store the file.');
        }
    }
    async getPresignedReadUrl(key) {
        const safeKey = this.validateStorageKey(key);
        const record = await this.prisma.storedFile.findUnique({ where: { key: safeKey } });
        if (!record || record.isDeleted) {
            throw new common_1.NotFoundException('The requested file does not exist or has been deleted.');
        }
        try {
            if (this.useLocalFallback) {
                return this.buildLocalUrl(record.key);
            }
            if (!this.s3Client) {
                throw new common_1.InternalServerErrorException('Cloud storage client not initialized');
            }
            const command = new client_s3_1.GetObjectCommand({ Bucket: this.bucket, Key: record.key });
            return await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn: 900 });
        }
        catch (error) {
            if (error instanceof common_1.InternalServerErrorException) {
                throw error;
            }
            this.logger.error(`Error generating presigned read URL: ${error.message}`);
            throw new common_1.InternalServerErrorException('Failed to retrieve secure file URL.');
        }
    }
    async softDeleteFile(key, userId) {
        const safeKey = this.validateStorageKey(key);
        const record = await this.prisma.storedFile.findUnique({ where: { key: safeKey } });
        if (!record || record.isDeleted) {
            throw new common_1.NotFoundException('The file does not exist or has already been deleted.');
        }
        if (record.uploadedById !== userId) {
            throw new common_1.ForbiddenException('You do not have permission to delete this file.');
        }
        try {
            if (this.useLocalFallback) {
                await fs_1.promises
                    .unlink(this.resolveLocalFilePath(record.key))
                    .catch((error) => {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                });
            }
            else {
                if (!this.s3Client) {
                    throw new common_1.InternalServerErrorException('Cloud storage client not initialized');
                }
                await this.s3Client.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket, Key: record.key }));
            }
            const updated = await this.prisma.storedFile.update({
                where: { key: record.key },
                data: {
                    isDeleted: true,
                    deletedAt: new Date(),
                    filename: 'DELETED_GDPR_COMPLIANCE_MASKED',
                },
            });
            this.logger.log(`GDPR Soft-delete completed for file key: ${record.key}`);
            return updated;
        }
        catch (error) {
            if (error instanceof common_1.InternalServerErrorException) {
                throw error;
            }
            this.logger.error(`Error during file soft-deletion: ${error.message}`);
            throw new common_1.InternalServerErrorException('Failed to delete file.');
        }
    }
    async getMyFiles(userId) {
        try {
            return await this.prisma.storedFile.findMany({
                where: { uploadedById: userId, isDeleted: false },
                orderBy: { createdAt: 'desc' },
            });
        }
        catch (error) {
            this.logger.error(`Error retrieving user files: ${error.message}`);
            throw new common_1.InternalServerErrorException('Failed to retrieve files list.');
        }
    }
    resolveLocalFilePath(key) {
        const safeKey = this.validateStorageKey(key);
        const localPath = path.resolve(this.localStoreDir, safeKey);
        const localRoot = path.resolve(this.localStoreDir);
        if (localPath !== localRoot && !localPath.startsWith(`${localRoot}${path.sep}`)) {
            throw new common_1.BadRequestException('Invalid file key pathway.');
        }
        return localPath;
    }
    resolveUploadTarget(folderOrConsent, mimeType) {
        if (typeof folderOrConsent === 'boolean') {
            return {
                hasConsentedToProcessing: folderOrConsent,
                folder: this.isImageMimeType(mimeType || '') ? 'images' : 'documents',
            };
        }
        return { hasConsentedToProcessing: true, folder: folderOrConsent };
    }
    async optimizeAsset(file) {
        const contentType = this.assertAllowedMimeType(file.mimetype);
        if (this.isImageMimeType(contentType)) {
            const webpBuffer = await this.convertImageToWebp(file.buffer);
            return { buffer: webpBuffer, contentType: 'image/webp', extension: '.webp', optimized: true };
        }
        return {
            buffer: file.buffer,
            contentType,
            extension: this.resolveSafeExtension(contentType),
            optimized: false,
        };
    }
    assertUploadableFile(file) {
        if (!file || !file.buffer || !file.mimetype || !file.originalname) {
            throw new common_1.BadRequestException('Invalid file payload.');
        }
        this.assertAllowedMimeType(file.mimetype);
        this.assertFileSize(file.size ?? file.buffer.length);
    }
    assertFileSize(fileSize) {
        if (!Number.isInteger(fileSize) || fileSize < 1) {
            throw new common_1.BadRequestException('Invalid file size.');
        }
        if (fileSize > uploads_constants_1.MAX_UPLOAD_FILE_SIZE_BYTES) {
            throw new common_1.BadRequestException(`File size must not exceed ${uploads_constants_1.MAX_UPLOAD_FILE_SIZE_BYTES} bytes.`);
        }
    }
    assertAllowedMimeType(mimeType) {
        if (!uploads_constants_1.ALLOWED_MIME_TYPES.includes(mimeType)) {
            throw new common_1.BadRequestException('Invalid file type. Executables and HTML files are not allowed.');
        }
        return mimeType;
    }
    isImageMimeType(mimeType) {
        return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp';
    }
    async convertImageToWebp(buffer) {
        try {
            return await (0, sharp_1.default)(buffer).webp({ quality: 80 }).toBuffer();
        }
        catch {
            throw new common_1.BadRequestException('Uploaded image is invalid or corrupted');
        }
    }
    validateStorageFolder(folder) {
        const normalized = folder
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '');
        if (!normalized || normalized.length > 128) {
            throw new common_1.BadRequestException('Invalid upload folder');
        }
        let decodedFolder = normalized;
        try {
            decodedFolder = decodeURIComponent(normalized);
        }
        catch {
            throw new common_1.BadRequestException('Invalid upload folder');
        }
        const segments = decodedFolder.split('/');
        const hasUnsafeSegment = segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(segment));
        if (hasUnsafeSegment) {
            throw new common_1.BadRequestException('Invalid upload folder');
        }
        return segments.join('/');
    }
    validateStorageKey(key) {
        const normalized = key
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '');
        if (!normalized || normalized.length > 255) {
            throw new common_1.BadRequestException('Invalid file key pathway.');
        }
        let decodedKey = normalized;
        try {
            decodedKey = decodeURIComponent(normalized);
        }
        catch {
            throw new common_1.BadRequestException('Invalid file key pathway.');
        }
        const segments = decodedKey.split('/');
        if (segments.length !== 2) {
            throw new common_1.BadRequestException('Invalid file key pathway.');
        }
        const [folder, filename] = segments;
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(folder)) {
            throw new common_1.BadRequestException('Invalid file key pathway.');
        }
        if (!/^[0-9a-f-]{36}\.(jpg|png|webp|pdf|doc|docx)$/i.test(filename)) {
            throw new common_1.BadRequestException('Invalid file key pathway.');
        }
        return `${folder}/${filename}`;
    }
    resolveSafeExtension(contentType) {
        const allowedMimeType = this.assertAllowedMimeType(contentType);
        return uploads_constants_1.MIME_TYPE_EXTENSIONS[allowedMimeType];
    }
    sanitizeFilename(filename) {
        const normalized = filename.replace(/\\/g, '/');
        const basename = normalized.split('/').pop()?.trim() || 'upload';
        return basename.slice(0, 255);
    }
    buildPublicUrl(key) {
        if (this.useLocalFallback) {
            return this.buildLocalUrl(key);
        }
        const cdnBaseUrl = this.config.get('CDN_BASE_URL');
        if (cdnBaseUrl) {
            return `${cdnBaseUrl.replace(/\/$/, '')}/${key}`;
        }
        const publicBaseUrl = this.config.get('R2_PUBLIC_BASE_URL');
        if (publicBaseUrl) {
            return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
        }
        const endpoint = this.config.get('AWS_ENDPOINT');
        if (endpoint) {
            return `${endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
        }
        return `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${key}`;
    }
    buildLocalUrl(key) {
        const apiBaseUrl = this.config.get('API_BASE_URL', 'http://localhost:4000/api/v1');
        return `${apiBaseUrl.replace(/\/$/, '')}/uploads/local-file/${key}`;
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map