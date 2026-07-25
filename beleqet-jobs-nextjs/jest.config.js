/** @type {import('jest').Config} */
const path = require('path');

module.exports = {
  displayName: "beleqet-jobs-frontend",
  testEnvironment: "jest-environment-jsdom",

  // Run Jest test suites and portfolio spec files
  testMatch: [
    "<rootDir>/jest-tests/**/*.test.{ts,tsx}",
    "<rootDir>/lib/**/*.spec.ts",
    "<rootDir>/app/portfolio/portfolio/**/*.spec.ts",
  ],

  // Load @testing-library/jest-dom matchers + matchMedia polyfill
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Transform TS/TSX with ts-jest
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
        esModuleInterop: true,
        moduleResolution: "node",
        strict: false,
        resolveJsonModule: true,
        noEmit: false,
        module: "commonjs",
        isolatedModules: true,
      },
    }],
  },

  // Resolve @/ path alias (portfolio alias must come first)
  moduleNameMapper: {
    "^@/portfolio/(.*)$": path.join(__dirname, "app/portfolio/portfolio/$1"),
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|scss)$": "<rootDir>/jest-tests/__mocks__/styleMock.js",
    "\\.(svg|png|jpg)$": "<rootDir>/jest-tests/__mocks__/fileMock.js",
  },

  // Allow Jest to transform ESM-only packages
  transformIgnorePatterns: [
    "/node_modules/(?!(next-themes|next-intl)/)",
  ],
};
