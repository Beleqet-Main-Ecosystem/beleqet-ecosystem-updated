/**
 * Jest setup file
 * Provides browser globals required by pdf-parse (DOMMatrix)
 */

// Set default timeout for tests (especially E2E booting full AppModule)
jest.setTimeout(90000);

// Mock DOMMatrix for pdf-parse
global.DOMMatrix = class DOMMatrix {
  constructor() {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
  }
};

// Mock otplib to prevent Jest from choking on its internal ESM dependency (@scure/base)
jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest
    .fn()
    .mockReturnValue('otpauth://totp/Test:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=Test'),
  generate: jest.fn().mockResolvedValue('123456'),
  verify: jest.fn().mockImplementation(({ token }) => {
    return Promise.resolve({ valid: token === '123456', delta: token === '123456' ? 0 : -1 });
  }),
}));

