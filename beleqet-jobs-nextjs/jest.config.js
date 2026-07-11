/** @type {import('jest').Config} */
module.exports = {
  displayName: "beleqet-jobs-frontend",
  testEnvironment: "jest-environment-jsdom",

  // Only run the Jest test suite for the new modules
  testMatch: ["<rootDir>/jest-tests/**/*.test.{ts,tsx}"],

  // Load @testing-library/jest-dom matchers + matchMedia polyfill
  // setupFilesAfterEnv runs after the Jest environment is ready so `expect` is available
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
      },
    }],
  },

  // Resolve @/ path alias
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|scss)$": "<rootDir>/jest-tests/__mocks__/styleMock.js",
    "\\.(svg|png|jpg)$": "<rootDir>/jest-tests/__mocks__/fileMock.js",
  },

  // Allow Jest to transform ESM-only packages
  transformIgnorePatterns: [
    "/node_modules/(?!(next-themes|next-intl)/)",
  ],
};
