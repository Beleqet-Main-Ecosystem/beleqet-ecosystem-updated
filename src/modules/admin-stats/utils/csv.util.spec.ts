import {
  csvEscape,
  formatMinorForCsv,
  formatStatusLabel,
  toCsvDocument,
} from './csv.util';

describe('csv.util', () => {
  it('escapes commas and quotes per RFC 4180', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('formats minor units into readable major money', () => {
    expect(formatMinorForCsv(125050, 'ETB')).toBe('1,250.50 ETB');
    expect(formatMinorForCsv(0, 'USD')).toBe('0.00 USD');
    expect(formatMinorForCsv(null, 'ETB')).toBe('');
  });

  it('formats status codes into labels', () => {
    expect(formatStatusLabel('IN_PROGRESS')).toBe('In Progress');
    expect(formatStatusLabel('OPEN')).toBe('Open');
  });

  it('builds a document with metadata, table, and notes', () => {
    const csv = toCsvDocument({
      title: 'Sample report',
      meta: [
        ['Currency', 'ETB'],
        ['Privacy', 'No emails'],
      ],
      headers: ['Metric', 'Value'],
      rows: [['Total users', 12]],
      notes: ['Divide money by 100'],
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Report,Sample report');
    expect(csv).toContain('Currency,ETB');
    expect(csv).toContain('Metric,Value');
    expect(csv).toContain('Total users,12');
    expect(csv).toContain('Note,Divide money by 100');
  });
});
