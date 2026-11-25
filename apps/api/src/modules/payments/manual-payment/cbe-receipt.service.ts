import { Injectable, Logger } from '@nestjs/common';
// pdf-parse's types use `export =` (CommonJS) with no `.default`; import via
// namespace syntax to avoid relying on esModuleInterop, which this project does not enable.
import * as pdfParse from 'pdf-parse';

/** What CBE's receipt says about one transfer. CBE masks the accounts: "1****1234". */
export interface CbeReceipt {
  reference: string;
  payer: string;
  payerAccount: string;
  receiver: string;
  receiverAccount: string;
  /** In santim, like plan prices. */
  amount: number;
  paidAt: Date;
}

export type CbeLookup =
  | { found: true; receipt: CbeReceipt }
  /** not-found: CBE has no such transfer for this account. unreadable: a receipt we can't read.
   *  unavailable: CBE's site didn't answer. */
  | { found: false; reason: 'not-found' | 'unreadable' | 'unavailable' };

/** CBE transfer references: "FT", then ten letters and digits (e.g. FT26326ABC12). */
const CBE_REFERENCE = /^FT[0-9A-Z]{10}$/;
const RECEIPT_SITE = 'https://apps.cbe.com.et:100/BranchReceipt';
/** CBE prints receipt times in Ethiopian time, UTC+3. */
const EAT_OFFSET_HOURS = 3;

/** The reference as CBE writes it, or null when it isn't a CBE transfer reference. */
export function normalizeCbeReference(reference: string): string | null {
  const cleaned = reference.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return CBE_REFERENCE.test(cleaned) ? cleaned : null;
}

/** True when CBE's masked account ("1****1234") can be the full account number given. */
export function sameCbeAccount(masked: string, account: string): boolean {
  const [first, last] = [masked.match(/^\d+/)?.[0] ?? '', masked.match(/\d+$/)?.[0] ?? ''];
  return (
    first.length > 0 && last.length >= 4 && account.startsWith(first) && account.endsWith(last)
  );
}

/** Reads the text of a CBE receipt PDF; null when something we need isn't in it. */
export function parseCbeReceiptText(text: string): CbeReceipt | null {
  const parties = text.match(
    /Payer\s*(.+?)\s*\n\s*Account\s*([\d*]+)\s*\n\s*Receiver\s*(.+?)\s*\n\s*Account\s*([\d*]+)/,
  );
  const reference = text.match(/Reference No\.[^\n]*?(FT[0-9A-Z]+)/)?.[1];
  const amount = text.match(/Transferred Amount\s*([\d,]+(?:\.\d{1,2})?)\s*ETB/)?.[1];
  const when = text.match(
    /Payment Date & Time\s*(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)/i,
  );
  if (!parties || !reference || !amount || !when) return null;

  const [, month, day, year, hour, minute, second, half] = when;
  const hour24 = (Number(hour) % 12) + (half.toUpperCase() === 'PM' ? 12 : 0);
  const paidAt = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      hour24 - EAT_OFFSET_HOURS,
      Number(minute),
      Number(second ?? 0),
    ),
  );
  return {
    reference,
    payer: parties[1],
    payerAccount: parties[2],
    receiver: parties[3],
    receiverAccount: parties[4],
    amount: Math.round(Number(amount.replace(/,/g, '')) * 100),
    paidAt,
  };
}

/**
 * Looks up a transfer on CBE's public receipt page, the one CBE links to in its SMS. The page needs
 * the reference and the last 8 digits of one of the transfer's accounts, so asking with our own
 * account only ever finds transfers to or from it.
 */
@Injectable()
export class CbeReceiptService {
  private static readonly TIMEOUT_MS = 15_000;
  private readonly logger = new Logger(CbeReceiptService.name);

  async lookup(reference: string, account: string): Promise<CbeLookup> {
    const url = `${RECEIPT_SITE}/${reference}&${account.slice(-8)}`;
    // One retry: CBE's site sometimes drops the first connection.
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(CbeReceiptService.TIMEOUT_MS) });
      } catch (err) {
        this.logger.warn(`CBE receipt site, attempt ${attempt}: ${(err as Error).message}`);
        continue;
      }
      const type = response.headers.get('content-type') ?? '';
      if (response.ok && type.includes('application/pdf')) {
        return this.read(Buffer.from(await response.arrayBuffer()));
      }
      // No such receipt: {"status":"failed","message":"Please Check Your Link"} (HTTP 200, or 500
      // for a reference CBE has never issued).
      if (type.includes('application/json')) {
        const body = (await response.json().catch(() => null)) as { status?: string } | null;
        if (body?.status === 'failed') return { found: false, reason: 'not-found' };
      }
      this.logger.warn(`CBE receipt site answered HTTP ${response.status} (${type || 'no type'})`);
      return { found: false, reason: 'unavailable' };
    }
    return { found: false, reason: 'unavailable' };
  }

  private async read(pdf: Buffer): Promise<CbeLookup> {
    try {
      const receipt = parseCbeReceiptText((await pdfParse(pdf)).text ?? '');
      if (receipt) return { found: true, receipt };
      this.logger.warn('A CBE receipt PDF did not have the fields we need');
    } catch (err) {
      this.logger.warn(`Could not read a CBE receipt PDF: ${(err as Error).message}`);
    }
    return { found: false, reason: 'unreadable' };
  }
}
