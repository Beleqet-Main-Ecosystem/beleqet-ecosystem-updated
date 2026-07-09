import { UnsupportedMediaTypeException } from '@nestjs/common';
import { ResumeParsingService } from './resume-parsing.service';
import { PdfParserService } from './pdf-parser.service';
import { DocxParserService } from './docx-parser.service';

describe('ResumeParsingService', () => {
  let service: ResumeParsingService;
  let pdfParser: { supports: jest.Mock; parse: jest.Mock };
  let docxParser: { supports: jest.Mock; parse: jest.Mock };

  beforeEach(() => {
    pdfParser = {
      supports: jest.fn((mime: string) => mime === 'application/pdf'),
      parse: jest.fn().mockResolvedValue({ text: 'pdf text', usedOcrFallback: false }),
    };
    docxParser = {
      supports: jest.fn(
        (mime: string) =>
          mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
      parse: jest.fn().mockResolvedValue({ text: 'docx text', usedOcrFallback: false }),
    };
    service = new ResumeParsingService(
      pdfParser as unknown as PdfParserService,
      docxParser as unknown as DocxParserService,
    );
  });

  it('should delegate to the PDF parser for application/pdf', async () => {
    const buffer = Buffer.from('pdf-bytes');
    const result = await service.parse(buffer, 'application/pdf');

    expect(pdfParser.parse).toHaveBeenCalledWith(buffer);
    expect(docxParser.parse).not.toHaveBeenCalled();
    expect(result.text).toBe('pdf text');
  });

  it('should delegate to the DOCX parser for docx mime type', async () => {
    const buffer = Buffer.from('docx-bytes');
    const result = await service.parse(
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    expect(docxParser.parse).toHaveBeenCalledWith(buffer);
    expect(result.text).toBe('docx text');
  });

  it('should throw for an unsupported mime type', async () => {
    await expect(service.parse(Buffer.from('x'), 'image/png')).rejects.toThrow(
      UnsupportedMediaTypeException,
    );
  });
});
