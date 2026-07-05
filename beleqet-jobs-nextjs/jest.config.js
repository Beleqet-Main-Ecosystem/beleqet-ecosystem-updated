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