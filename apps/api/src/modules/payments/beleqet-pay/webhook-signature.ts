import { createHmac, timingSafeEqual } from 'crypto';
import { BeleqetPayWebhookEvent } from './beleqet-pay.types';

/** How far a webhook's signed timestamp may be from now. */
const MAX_AGE_SECONDS = 300;

/**
 * Checks a Beleqet Pay webhook: `X-Beleqet-Signature: sha256=<hex>` is the HMAC-SHA256 of the raw
 * body with the endpoint's signing secret, and the timestamp inside the body is within 5 minutes.
 * Returns the event, or null for anything that fails.
 */
export function verifyBeleqetPayWebhook(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
  nowSeconds = Date.now() / 1000,
): BeleqetPayWebhookEvent | null {
  if (!header || !secret) return null;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`,
  );
  const given = Buffer.from(header.trim());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let event: BeleqetPayWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString('utf8')) as BeleqetPayWebhookEvent;
  } catch {
    return null;
  }
  if (typeof event?.id !== 'string' || typeof event.event !== 'string') return null;
  if (
    typeof event.timestamp !== 'number' ||
    Math.abs(nowSeconds - event.timestamp) > MAX_AGE_SECONDS
  ) {
    return null;
  }
  return { ...event, data: event.data ?? {} };
}
