/**
 * Domains of addresses the platform invents, which no mail server will ever accept:
 * accounts created by the Telegram bot (beleqet.internal), Telegram Mini App sign-ins
 * (tme.beleqet.local) and erased accounts (also beleqet.internal).
 */
const PLACEHOLDER_DOMAINS = ['beleqet.internal', 'tme.beleqet.local'];

/** False for an invented placeholder address, so senders skip it instead of failing on every attempt. */
export function isDeliverableEmail(address: string | null | undefined): boolean {
  const domain = (address ?? '').trim().toLowerCase().split('@')[1];
  return Boolean(domain) && !PLACEHOLDER_DOMAINS.includes(domain);
}
