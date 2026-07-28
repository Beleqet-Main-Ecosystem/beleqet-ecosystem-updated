"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DocumentParserService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentParserService = void 0;
const common_1 = require("@nestjs/common");
const path = require("path");
const mammoth = require("mammoth");
const pdf_parse_1 = require("pdf-parse");
let DocumentParserService = DocumentParserService_1 = class DocumentParserService {
    constructor() {
        this.logger = new common_1.Logger(DocumentParserService_1.name);
    }
    async extractText(file) {
        const kind = this.detectKind(file);
        let rawText;
        try {
            rawText =
                kind === 'pdf' ? await this.parsePdf(file.buffer) : await this.parseDocx(file.buffer);
        }
        catch (err) {
            this.logger.error(`Failed to extract text from ${kind} "${file.originalname}": ${err.message}`);
            throw new common_1.UnprocessableEntityException(`Could not read the ${kind.toUpperCase()} file. ` +
                'It may be corrupted or password-protected.');
        }
        const text = this.normalize(rawText);
        if (!text) {
            throw new common_1.UnprocessableEntityException('No readable text found in the document. ' +
                'Scanned or image-only resumes are not supported.');
        }
        this.logger.log(`Extracted ${text.length} characters from ${kind} "${file.originalname}".`);
        return text;
    }
    detectKind(file) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const mime = file.mimetype;
        if (mime === 'application/pdf' || ext === '.pdf') {
            return 'pdf';
        }
        if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            ext === '.docx') {
            return 'docx';
        }
        throw new common_1.UnprocessableEntityException('Legacy .doc files cannot be read. Please upload a PDF or DOCX resume.');
    }
    async parsePdf(buffer) {
        const parser = new pdf_parse_1.PDFParse({ data: new Uint8Array(buffer) });
        try {
            const result = await parser.getText();
            return result.text ?? '';
        }
        finally {
            await parser.destroy();
        }
    }
    async parseDocx(buffer) {
        const { value } = await mammoth.extractRawText({ buffer });
        return value ?? '';
    }
    normalize(text) {
        return text
            .replace(/^\s*-+\s*\d+\s+of\s+\d+\s*-+\s*$/gim, '')
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
};
exports.DocumentParserService = DocumentParserService;
exports.DocumentParserService = DocumentParserService = DocumentParserService_1 = __decorate([
    (0, common_1.Injectable)()
], DocumentParserService);
//# sourceMappingURL=document-parser.service.js.map