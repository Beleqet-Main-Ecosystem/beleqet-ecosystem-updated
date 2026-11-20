/**
 * Builds a minimal, spec-valid single-page PDF containing the given text,
 * for use as a real (non-mocked) test fixture in parser and e2e tests.
 * Byte offsets in the xref table are computed from the actual assembled
 * content rather than hardcoded, so this stays correct if the objects change.
 *
 * @param text - Text to render on the PDF page (escaped for PDF string syntax).
 * @returns A valid PDF file as a Buffer.
 */
export function buildMinimalPdf(text: string): Buffer {
  const escaped = text.replace(/([()\\])/g, '\\$1');

  const objects: string[] = [
    '', // 0-index unused
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    '', // placeholder, filled below (needs stream length)
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  const stream = `BT /F1 18 Tf 72 700 Td (${escaped}) Tj ET`;
  objects[4] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}
