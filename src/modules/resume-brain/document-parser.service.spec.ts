import { UnprocessableEntityException } from '@nestjs/common';

// Mock the heavy parsing libraries so these stay fast, pure unit tests.
jest.mock('pdf-parse', () => ({ PDFParse: jest.fn() }));
jest.mock('mammoth', () => ({ extractRawText: jest.fn() }));

import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { DocumentParserService } from './document-parser.service';
import { UploadedResumeFile } from './resume-brain.service';

const PDFParseMock = PDFParse as unknown as jest.Mock;
const extractRawTextMock = mammoth.extractRawText as unknown as jest.Mock;

const makeFile = (over: Partial<UploadedResumeFile> = {}): UploadedResumeFile => ({
  originalname: 'resume.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  buffer: Buffer.from('%PDF-1.4 dummy'),
  ...over,
});

/** Wire up the PDFParse mock to return a given text (and a spyable destroy). */
const mockPdfText = (text: string) => {
  const destroy = jest.fn().mockResolvedValue(undefined);
  const getText = jest.fn().mockResolvedValue({ text, pages: [] });
  PDFParseMock.mockImplementation(() => ({ getText, destroy }));
  return { getText, destroy };
};

describe('DocumentParserService', () => {
  let service: DocumentParserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentParserService();
  });

  describe('PDF', () => {
    it('extracts and returns the plain text of a PDF', async () => {
      mockPdfText('John Doe\nSoftware Engineer\nSkills: Node, React');

      await expect(service.extractText(makeFile())).resolves.toBe(
        'John Doe\nSoftware Engineer\nSkills: Node, React',
      );
      expect(PDFParseMock).toHaveBeenCalledTimes(1);
    });

    it('always releases the pdfjs worker via destroy()', async () => {
      const { destroy } = mockPdfText('some text');
      await service.extractText(makeFile());
      expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('strips pdf-parse page markers and collapses blank lines', async () => {
      mockPdfText('First page text\n\n-- 1 of 2 --\n\n\n\nSecond page text');

      await expect(service.extractText(makeFile())).resolves.toBe(
        'First page text\n\nSecond page text',
      );
    });

    it('throws 422 when the PDF has no readable text (scanned/image-only)', async () => {
      mockPdfText('   \n  \n');

      await expect(service.extractText(makeFile())).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws 422 when the PDF cannot be parsed (corrupt/encrypted)', async () => {
      const destroy = jest.fn().mockResolvedValue(undefined);
      PDFParseMock.mockImplementation(() => ({
        getText: jest.fn().mockRejectedValue(new Error('Invalid PDF structure')),
        destroy,
      }));

      await expect(service.extractText(makeFile())).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(destroy).toHaveBeenCalledTimes(1); // still cleaned up
    });
  });

  describe('DOCX', () => {
    const docxFile = () =>
      makeFile({
        originalname: 'cv.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    it('extracts and returns the plain text of a DOCX', async () => {
      extractRawTextMock.mockResolvedValue({
        value: 'Jane Doe\nProduct Manager',
        messages: [],
      });

      await expect(service.extractText(docxFile())).resolves.toBe(
        'Jane Doe\nProduct Manager',
      );
      expect(PDFParseMock).not.toHaveBeenCalled();
    });

    it('throws 422 when mammoth fails', async () => {
      extractRawTextMock.mockRejectedValue(new Error('not a valid zip'));

      await expect(service.extractText(docxFile())).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('unsupported formats', () => {
    it('rejects legacy binary .doc with a clear 422', async () => {
      const doc = makeFile({
        originalname: 'cv.doc',
        mimetype: 'application/msword',
      });

      await expect(service.extractText(doc)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(PDFParseMock).not.toHaveBeenCalled();
      expect(extractRawTextMock).not.toHaveBeenCalled();
    });
  });
});
