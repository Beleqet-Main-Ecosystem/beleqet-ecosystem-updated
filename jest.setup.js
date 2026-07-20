/**
 * Jest setup file
 * Provides browser globals required by pdf-parse (DOMMatrix)
 */

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
