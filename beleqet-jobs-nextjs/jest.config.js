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
/**
 * @file jest.config.js
 * @description Jest configuration for the Beleqet Jobs mobile dashboard
 *   module.  Uses `ts-jest` for TypeScript compilation and
 *   `@testing-library/jest-dom` for DOM assertion matchers.
 */

const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname);

/** @type {import('jest').Config} */
module.exports = {
  rootDir: PROJECT_ROOT,
  testEnvironment: "jsdom",
  modulePaths: [PROJECT_ROOT],
  moduleNameMapper: {
    "^@/(.*)$": path.join(PROJECT_ROOT, "$1"),
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          ...require("./tsconfig.json").compilerOptions,
          jsx: "react-jsx",
        },
      },
    ],
  },
  testMatch: [
    path.join(PROJECT_ROOT, "**/__tests__/**/*.test.ts"),
    path.join(PROJECT_ROOT, "**/__tests__/**/*.test.tsx"),
  ],
  collectCoverageFrom: [
    path.join(PROJECT_ROOT, "components/mobile/**/*.{ts,tsx}"),
    path.join(PROJECT_ROOT, "lib/i18n.tsx"),
    "!**/node_modules/**",
  ],
};