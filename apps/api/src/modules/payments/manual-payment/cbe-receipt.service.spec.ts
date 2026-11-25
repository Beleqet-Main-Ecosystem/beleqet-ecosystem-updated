import * as pdfParse from 'pdf-parse';
import {
  CbeReceiptService,
  normalizeCbeReference,
  parseCbeReceiptText,
  sameCbeAccount,
} from './cbe-receipt.service';

// pdf-parse's vendored pdf.js build is unreliable under ts-jest; the text it gives is tested below.
jest.mock('pdf-parse');

/** The text pdf-parse gets from a CBE receipt, laid out as CBE's are (names and numbers made up). */
const RECEIPT_TEXT = `

Commercial Bank of Ethiopia
VAT Invoice/Customer Receipt - Branch Receipt
Company Address & Other Information
Country:
VAT Receipt No:
Ethiopia
FT26329AB12C
Customer Information
Customer Name:
Branch:
ABEBE KEBEDE TOLA
DIGITAL BANKING
Payment / Transaction Information
PayerABEBE KEBEDE TOLA
Account1****5678
ReceiverBELEQET TEST ACCOUNT
Account1****1234
Payment Date & Time11/25/2026, 1:09:00 PM
Reference No. (VAT Invoice No)FT26329AB12C
Reason / Type of service
Transferred Amount4,999.00 ETB
Commission or Service Charge0.00 ETB
15% VAT on Commission0.00 ETB
Total amount debited from customers account4,999.00 ETB
Amount in Word
ETB  Four Thousand Nine Hundred Ninety Nine & Zero cents
`;

describe('CBE receipts', () => {
  it('reads who paid whom, how much, when, and the reference', () => {
    expect(parseCbeReceiptText(RECEIPT_TEXT)).toEqual({
      reference: 'FT26329AB12C',
      payer: 'ABEBE KEBEDE TOLA',
      payerAccount: '1****5678',
      receiver: 'BELEQET TEST ACCOUNT',
      receiverAccount: '1****1234',
      amount: 499900,
      // 1:09 PM in Addis Ababa is 10:09 UTC.
      paidAt: new Date('2026-11-25T10:09:00Z'),
    });
  });

  it('reads 12 AM and 12 PM the right way round', () => {
    const at = (time: string) =>
      parseCbeReceiptText(RECEIPT_TEXT.replace('1:09:00 PM', time))?.paidAt.toISOString();
    expect(at('12:05:00 AM')).toBe('2026-11-24T21:05:00.000Z');
    expect(at('12:05:00 PM')).toBe('2026-11-25T09:05:00.000Z');
  });

  it('gives nothing for a page that is not a receipt', () => {
    expect(parseCbeReceiptText('')).toBeNull();
    expect(parseCbeReceiptText(RECEIPT_TEXT.replace(/Transferred Amount.*\n/, ''))).toBeNull();
  });

  it('knows a CBE reference however it was typed', () => {
    expect(normalizeCbeReference(' ft26329 ab12c ')).toBe('FT26329AB12C');
    expect(normalizeCbeReference('FT-26329-AB12C')).toBe('FT26329AB12C');
    for (const other of ['', 'FT123', 'TXN-999', 'CB12345678901', 'FT26329AB12C9']) {
      expect(normalizeCbeReference(other)).toBeNull();
    }
  });

  it("matches CBE's masked account to the full number", () => {
    expect(sameCbeAccount('1****1234', '1000777661234')).toBe(true);
    expect(sameCbeAccount('1****1234', '1000777664321')).toBe(false);
    expect(sameCbeAccount('1****1234', '2000777661234')).toBe(false);
    expect(sameCbeAccount('****', '1000777661234')).toBe(false);
  });
});

describe('CbeReceiptService.lookup', () => {
  const service = new CbeReceiptService();
  const fetchMock = jest.spyOn(global, 'fetch');
  const reply = (body: string, type: string, status = 200) =>
    new Response(body, { status, headers: { 'content-type': type } });

  beforeEach(() => {
    fetchMock.mockReset();
    (pdfParse as unknown as jest.Mock).mockReset();
  });
  afterAll(() => fetchMock.mockRestore());

  it("asks with the reference and our account's last 8 digits, and reads the PDF", async () => {
    fetchMock.mockResolvedValue(reply('%PDF-1.4', 'application/pdf'));
    (pdfParse as unknown as jest.Mock).mockResolvedValue({ text: RECEIPT_TEXT });

    const result = await service.lookup('FT26329AB12C', '1000777661234');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://apps.cbe.com.et:100/BranchReceipt/FT26329AB12C&77661234',
      expect.anything(),
    );
    expect(result).toMatchObject({ found: true, receipt: { amount: 499900 } });
  });

  it('says not-found when CBE has no such transfer for the account', async () => {
    fetchMock.mockResolvedValueOnce(
      reply('{"status":"failed","message":"Please Check Your Link "}', 'application/json'),
    );
    expect(await service.lookup('FT26329AB12C', '1000777661234')).toEqual({
      found: false,
      reason: 'not-found',
    });
    fetchMock.mockResolvedValueOnce(
      reply(
        '{"status":"failed","message":"Receipt Data is not correct."}',
        'application/json',
        500,
      ),
    );
    expect(await service.lookup('FT26329ZZZZZ', '1000777661234')).toMatchObject({
      reason: 'not-found',
    });
  });

  it('tries twice when the site does not answer, then says unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('socket hang up'));
    expect(await service.lookup('FT26329AB12C', '1000777661234')).toEqual({
      found: false,
      reason: 'unavailable',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('says unavailable for an error page, and unreadable for a PDF it cannot read', async () => {
    fetchMock.mockResolvedValueOnce(reply('<html>Bad gateway</html>', 'text/html', 502));
    expect(await service.lookup('FT26329AB12C', '1000777661234')).toMatchObject({
      reason: 'unavailable',
    });
    fetchMock.mockResolvedValueOnce(reply('%PDF-1.4', 'application/pdf'));
    (pdfParse as unknown as jest.Mock).mockResolvedValue({ text: 'Something else' });
    expect(await service.lookup('FT26329AB12C', '1000777661234')).toMatchObject({
      reason: 'unreadable',
    });
  });
});
