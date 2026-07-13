/**
 * Plain text extracted from a CV/resume source document.
 */
export interface ParsedDocument {
  /** Full extracted text content of the document. */
  text: string;
  /** True when the text layer was empty/unreadable and OCR had to be used instead. */
  usedOcrFallback: boolean;
}

/**
 * A document format parser capable of turning a raw file buffer into plain text.
 * Implementations are swappable/pluggable — the orchestrator selects one by MIME type.
 */
export interface ResumeParser {
  /**
   * Reports whether this parser can handle the given MIME type.
   *
   * @param mimeType - MIME type detected for the uploaded file.
   */
  supports(mimeType: string): boolean;

  /**
   * Extracts plain text from a document buffer.
   *
   * @param buffer - Raw bytes of the uploaded file.
   * @returns The extracted text and whether OCR was required to obtain it.
   */
  parse(buffer: Buffer): Promise<ParsedDocument>;
}
