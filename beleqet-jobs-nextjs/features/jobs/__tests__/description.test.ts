import { descriptionText, parseDescription } from '../description';

describe('parseDescription', () => {
  it('turns imported HTML into headings, paragraphs and lists', () => {
    const html =
      '<h1>Senior Accountant</h1>\r\n<h2>Brief Summary</h2>\r\nWe are seeking an experienced <b>Senior Accountant</b>.' +
      '<h2>Duties</h2><ul><li>Close the books</li><li>File VAT &amp; withholding</li></ul>';
    expect(parseDescription(html, 'Senior Accountant')).toEqual([
      { kind: 'heading', text: 'Brief Summary' },
      { kind: 'paragraph', text: 'We are seeking an experienced Senior Accountant.' },
      { kind: 'heading', text: 'Duties' },
      { kind: 'list', items: ['Close the books', 'File VAT & withholding'] },
    ]);
  });

  it('keeps plain text and groups bullet lines', () => {
    const text = 'About the Job\r\n\r\nWe build payments.\n• Node.js\n• Go\n- PostgreSQL';
    expect(parseDescription(text)).toEqual([
      { kind: 'paragraph', text: 'About the Job' },
      { kind: 'paragraph', text: 'We build payments.' },
      { kind: 'list', items: ['Node.js', 'Go', 'PostgreSQL'] },
    ]);
  });

  it('never lets markup through: scripts are dropped, tags removed, entities decoded as text', () => {
    const blocks = parseDescription('<p>Hi<script>alert(1)</script><img src=x onerror=alert(2)> &lt;b&gt;</p>');
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'Hi <b>' }]);
    // The decoded "<b>" is text: React escapes it when rendering.
  });

  it('handles empty input', () => {
    expect(parseDescription(null)).toEqual([]);
    expect(parseDescription('   ')).toEqual([]);
  });

  it('flattens back to text for structured data', () => {
    expect(descriptionText([{ kind: 'heading', text: 'Duties' }, { kind: 'list', items: ['A', 'B'] }])).toBe('Duties\n\n• A\n• B');
  });
});
