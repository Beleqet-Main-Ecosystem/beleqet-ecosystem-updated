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
let UploadsService = UploadsService_1 = class UploadsService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(UploadsService_1.name);
        this.bucket =
            this.config.get('R2_BUCKET_NAME') ??
                this.config.get('AWS_S3_BUCKET', 'beleqet-uploads');
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
    async generatePresignedUrl(filename, contentType, folder = 'misc') {
        if (!this.s3Client)
            throw new common_1.InternalServerErrorException('Cloud storage not configured on server');
        const ext = path.extname(filename);
        const key = `${folder}/${(0, uuid_1.v4)()}${ext}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
        });
        const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn: 900 });
        const publicBaseUrl = this.config.get('R2_PUBLIC_BASE_URL');
        const endpoint = this.config.get('AWS_ENDPOINT');
        let publicUrl = '';
        if (publicBaseUrl) {
            publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
        }
        else if (endpoint) {
            publicUrl = `${endpoint}/${this.bucket}/${key}`;
        }
        else {
            publicUrl = `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${key}`;
        }
        return { presignedUrl, publicUrl, key };
    }
    async uploadFile(file, folder = 'misc') {
        if (!this.s3Client)
            throw new common_1.InternalServerErrorException('Cloud storage not configured on server');
        const ext = path.extname(file.originalname);
        const key = `${folder}/${(0, uuid_1.v4)()}${ext}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        });
        await this.s3Client.send(command);
        const publicBaseUrl = this.config.get('R2_PUBLIC_BASE_URL');
        const endpoint = this.config.get('AWS_ENDPOINT');
        let publicUrl = '';
        if (publicBaseUrl) {
            publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
        }
        else if (endpoint) {
            publicUrl = `${endpoint}/${this.bucket}/${key}`;
        }
        else {
            publicUrl = `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${key}`;
        }
        return { publicUrl, key };
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map