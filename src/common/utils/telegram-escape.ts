/**
 * Escapes Markdown-special characters in a dynamic value so it renders
 * as literal text when sent via Telegram with parse_mode: 'Markdown'.
 *
 * WHY this exists:
 *   Telegram's Markdown parser interprets _ * ` [ as formatting.
 *   User-generated content (names, titles, descriptions) can contain
 *   these characters and break message delivery entirely.
 *
 *   We escape only the dynamic values, NOT the entire message, so that
 *   intentional Markdown formatting (e.g. *bold*) from producers is preserved.
 *
 * USAGE:
 *   message: `Hello *${escapeTelegramMarkdown(name)}*, welcome!`
 *   // name = "O'Connor"  → safe
 *   // name = "A_B_C"     → escaped to "A\_B\_C"
 *
 * Characters escaped: _ * ` [
 */
export function escapeTelegramMarkdown(text: string): string {
  if (!text) return text;
  return text.replace(/([[\]_*`])/g, '\\$1');
}
