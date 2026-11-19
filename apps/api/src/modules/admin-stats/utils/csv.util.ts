/** Escape a CSV field per RFC 4180. */
export function csvEscape(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export type CsvCell = string | number | null | undefined;

export interface CsvDocumentOptions {
  /** Human title shown in the metadata block */
  title: string;
  /** Key/value context so the file is self-explanatory when opened in Excel */
  meta: Array<[string, CsvCell]>;
  /** Column headers for the data table */
  headers: string[];
  /** Data rows */
  rows: CsvCell[][];
  /** Optional notes printed after the table */
  notes?: string[];
}

/**
 * Format minor money units as a readable major amount (e.g. 125050 → "1,250.50 ETB").
 * Admin Stats stores money as integer minor units.
 */
export function formatMinorForCsv(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '';
  const major = Number(amount) / 100;
  return `${major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

/** Human-readable freelance status for CSV (OPEN → Open). */
export function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Build a self-documenting CSV:
 * 1) UTF-8 BOM (Excel-friendly)
 * 2) Metadata key/value block
 * 3) Blank separator
 * 4) Header + data rows
 * 5) Optional notes
 */
export function toCsvDocument(options: CsvDocumentOptions): string {
  const lines: string[] = [];

  lines.push(['Report', options.title].map(csvEscape).join(','));
  for (const [key, value] of options.meta) {
    lines.push([key, value].map(csvEscape).join(','));
  }
  lines.push('');
  lines.push(options.headers.map(csvEscape).join(','));
  for (const row of options.rows) {
    lines.push(row.map(csvEscape).join(','));
  }

  if (options.notes?.length) {
    lines.push('');
    for (const note of options.notes) {
      lines.push(['Note', note].map(csvEscape).join(','));
    }
  }

  // BOM helps Excel detect UTF-8; keep `\n` line endings for RFC 4180 / Unix tools.
  return `\uFEFF${lines.join('\n')}\n`;
}

/** @deprecated Prefer {@link toCsvDocument} for Admin Stats exports. */
export function toCsv(headers: string[], rows: Array<Array<CsvCell>>): string {
  return toCsvDocument({
    title: 'Admin Stats export',
    meta: [],
    headers,
    rows,
  });
}
