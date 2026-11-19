const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Serialises structured data for a `<script type="application/ld+json">` tag.
 *
 * Plain `JSON.stringify` is not safe there: a value containing `</script>`
 * (an employer-written job title or description) would end the tag and let the
 * rest run as HTML. Escaping `<`, `>` and `&` as \u escapes keeps the JSON
 * identical to parsers while making it inert in HTML; the line and paragraph
 * separators are escaped so the output is also valid JavaScript.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEPARATOR)
    .join('\\u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join('\\u2029');
}
