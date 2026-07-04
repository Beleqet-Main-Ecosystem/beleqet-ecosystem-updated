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
const uuid_1 = require("uuid");
const path = require("path");
const sharp_1 = require("sharp");
const terser_1 = require("terser");
const clean_css_1 = require("clean-css");
const zlib_1 = require("zlib");
const nestjs_i18n_1 = require("nestjs-i18n");
let UploadsService = UploadsService_1 = class UploadsService {
    constructor(config, i18n) {
        this.config = config;
        this.i18n = i18n;
        this.logger = new common_1.Logger(UploadsService_1.name);
        this.bucket =
            this.config.get('R2_BUCKET_NAME') ??
                this.config.get('AWS_S3_BUCKET', 'beleqet-uploads');
        this.immutableCacheControl = this.config.get('CDN_CACHE_CONTROL', 'public, max-age=31536000, immutable');
        const endpoint = this.config.get('AWS_ENDPOINT') ??
            (this.config.get('R2_ACCOUNT_ID')
                ? `https://${this.config.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`
                : undefined);
        const region = this.config.get('AWS_REGION', 'us-east-1');
        const accessKeyId = this.config.get('R2_ACCESS_KEY_ID') ?? this.config.get('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.config.get('R2_SECRET_ACCESS_KEY') ??
            this.config.get('AWS_SECRET_ACCESS_KEY');
        if (accessKeyId && secretAccessKey) {
            this.s3Client = new client_s3_1.S3Client({
                region,
                ...(endpoint && { endpoint }),
                credentials: { accessKeyId, secretAccessKey },
            });
        }
        else {
            this.logger.warn('AWS credentials not found in .env. Uploads will fail.');
        }
    }
    async generatePresignedUrl(filename, contentType, folder = 'misc', language = 'en') {
        if (!this.s3Client)
            throw new common_1.InternalServerErrorException('Cloud storage not configured on server');
        const ext = path.extname(filename);
        const key = `${folder}/${(0, uuid_1.v4)()}${ext}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
            CacheControl: this.immutableCacheControl,
        });
        const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn: 900 });
        return {
            message: this.i18n.translate('messages.uploads.presignedUrlCreated', { lang: language }),
            presignedUrl,
            publicUrl: this.buildPublicUrl(key),
            key,
            cacheControl: this.immutableCacheControl,
        };
    }
    async uploadFile(file, folder = 'misc', language = 'en') {
        if (!this.s3Client)
            throw new common_1.InternalServerErrorException('Cloud storage not configured on server');
        const optimizedAsset = await this.optimizeAsset(file);
        const key = `${folder}/${(0, uuid_1.v4)()}${optimizedAsset.extension}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: optimizedAsset.buffer,
            ContentType: optimizedAsset.contentType,
            CacheControl: this.immutableCacheControl,
            ContentEncoding: optimizedAsset.contentEncoding,
        });
        await this.s3Client.send(command);
        return {
            message: this.i18n.translate('messages.uploads.assetUploaded', { lang: language }),
            publicUrl: this.buildPublicUrl(key),
            key,
            cacheControl: this.immutableCacheControl,
            contentType: optimizedAsset.contentType,
            contentEncoding: optimizedAsset.contentEncoding,
            optimized: optimizedAsset.optimized,
        };
    }
    buildPublicUrl(key) {
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
    async optimizeAsset(file) {
        if (this.isImageMimeType(file.mimetype)) {
            const webpBuffer = await (0, sharp_1.default)(file.buffer).webp({ quality: 80 }).toBuffer();
            return {
                buffer: webpBuffer,
                contentType: 'image/webp',
                extension: '.webp',
                optimized: true,
            };
        }
        if (this.isTextMinifiableMimeType(file.mimetype)) {
            const minifiedBuffer = await this.minifyTextBuffer(file.buffer, file.mimetype);
            const gzipped = this.gzipIfBeneficial(minifiedBuffer);
            return {
                buffer: gzipped.buffer,
                contentType: file.mimetype,
                extension: path.extname(file.originalname),
                contentEncoding: gzipped.contentEncoding,
                optimized: minifiedBuffer.length !== file.buffer.length || !!gzipped.contentEncoding,
            };
        }
        return {
            buffer: file.buffer,
            contentType: file.mimetype,
            extension: path.extname(file.originalname),
            optimized: false,
        };
    }
    isImageMimeType(mimeType) {
        return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
    }
    isTextMinifiableMimeType(mimeType) {
        const minifiableTypes = new Set([
            'application/javascript',
            'text/javascript',
            'text/css',
            'text/html',
            'application/json',
            'image/svg+xml',
            'text/plain',
            'application/xml',
            'text/xml',
        ]);
        return minifiableTypes.has(mimeType);
    }
    async minifyTextBuffer(buffer, mimeType) {
        const content = buffer.toString('utf-8');
        if (mimeType === 'application/javascript' || mimeType === 'text/javascript') {
            try {
                const result = await (0, terser_1.minify)(content, {
                    compress: true,
                    mangle: true,
                });
                if (result.code) {
                    return Buffer.from(result.code, 'utf-8');
                }
            }
            catch (error) {
                this.logger.warn(`JavaScript minification skipped: ${error.message}`);
            }
            return buffer;
        }
        if (mimeType === 'text/css') {
            const result = new clean_css_1.default({ level: 2 }).minify(content);
            if (result.styles) {
                return Buffer.from(result.styles, 'utf-8');
            }
            return buffer;
        }
        if (mimeType === 'application/json') {
            try {
                return Buffer.from(JSON.stringify(JSON.parse(content)), 'utf-8');
            }
            catch {
                return buffer;
            }
        }
        const collapsed = content
            .replace(/>\s+</g, '><')
            .replace(/\s{2,}/g, ' ')
            .trim();
        return Buffer.from(collapsed, 'utf-8');
    }
    gzipIfBeneficial(buffer) {
        if (buffer.length < 1_024) {
            return { buffer };
        }
        const gzipped = (0, zlib_1.gzipSync)(buffer, { level: 9 });
        if (gzipped.length < buffer.length) {
            return { buffer: gzipped, contentEncoding: 'gzip' };
        }
        return { buffer };
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        nestjs_i18n_1.I18nService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map