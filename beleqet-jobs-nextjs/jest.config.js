/**
 * Jest config for the Next.js frontend.
 *
 * Scope: pure, framework-free modules under `lib/` tested via ts-jest.
 * Jest owns `*.spec.ts`; Vitest (vitest.config.ts) owns `*.test.ts`, so the two
 * runners never pick up each other's files. Run with `npm run jest`.
 */
const path = require("path");

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/lib"],
  testMatch: ["**/*.spec.ts"],
  moduleNameMapper: {
    "^@/(.*)$": path.join(__dirname, "$1"),
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        // The app tsconfig sets noEmit; ts-jest needs to emit, so relax that
        // and target CommonJS for the Node test runtime.
        tsconfig: {
          noEmit: false,
          module: "commonjs",
          esModuleInterop: true,
          isolatedModules: true,
        },
      },
    ],
  },
};
