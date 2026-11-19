/**
 * Job descriptions arrive as plain text or as employer-written HTML (imported
 * listings use <h1>, <h2>, <p>, <li>, &amp; …). Rendering that HTML directly
 * would let a listing inject script, so it is turned into plain-text blocks
 * that React renders as text: headings, paragraphs and bullet lists. No markup
 * from the listing ever reaches the page.
 */

export type DescriptionBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const HEADING = '\u0001';
const BULLET = '\u0002';

/** Flattens HTML (or plain text) into lines, marking headings and list items. */
function toLines(source: string): string[] {
  const text = source
    .replace(/\r\n?/g, '\n')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, `\n${HEADING}`)
    .replace(/<li[^>]*>/gi, `\n${BULLET}`)
    .replace(/<\/(h[1-6]|p|div|li|ul|ol|tr|section|article)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter((line) => line && line !== HEADING && line !== BULLET);
}

const TEXT_BULLET = /^[•\-*–·]\s+/;

export function parseDescription(source: string | null | undefined, skipHeading?: string): DescriptionBlock[] {
  if (!source) return [];
  const blocks: DescriptionBlock[] = [];
  const skip = skipHeading?.trim().toLowerCase();

  for (const line of toLines(source)) {
    if (line.startsWith(HEADING)) {
      const text = line.slice(1).trim();
      // Imported listings repeat the job title as their first heading.
      if (text && !(blocks.length === 0 && text.toLowerCase() === skip)) blocks.push({ kind: 'heading', text });
      continue;
    }
    const isItem = line.startsWith(BULLET) || TEXT_BULLET.test(line);
    if (isItem) {
      const item = line.replace(BULLET, '').replace(TEXT_BULLET, '').trim();
      if (!item) continue;
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
      continue;
    }
    blocks.push({ kind: 'paragraph', text: line });
  }
  return blocks;
}

/** Plain text for search-engine data and previews. */
export function descriptionText(blocks: DescriptionBlock[]): string {
  return blocks.map((b) => (b.kind === 'list' ? b.items.map((i) => `• ${i}`).join('\n') : b.text)).join('\n\n');
}
