/**
 * Jest config for the Next.js frontend.
 *
 * Two projects:
 *   1. "lib-unit"        — pure ts-jest tests under lib/ (Node env, *.spec.ts)
 *   2. "components-unit" — React component tests under components/__tests__ (jsdom, *.test.tsx)
 *
 * Vitest owns lib/__tests__/**.test.ts — those are excluded from Jest.
 */
const path = require("path");

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // ── 1. Pure lib/ modules (Node, no DOM) ─────────────────────────────────
    {
      displayName: "lib-unit",
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
            tsconfig: {
              noEmit: false,
              module: "commonjs",
              esModuleInterop: true,
              isolatedModules: true,
            },
          },
        ],
      },
    },

    // ── 2. React components (jsdom, *.test.tsx) ──────────────────────────────
    {
      displayName: "components-unit",
      preset: "ts-jest",
      testEnvironment: "jest-environment-jsdom",
      roots: ["<rootDir>/components"],
      testMatch: ["**/__tests__/**/*.test.tsx", "**/__tests__/**/*.test.ts"],
      setupFilesAfterEnv: ["@testing-library/jest-dom"],
      moduleNameMapper: {
        "^@/(.*)$": path.join(__dirname, "$1"),
        // Stub CSS / static assets
        "\\.(css|less|scss|svg|png|jpg)$": "<rootDir>/__mocks__/fileMock.js",
      },
      transform: {
        "^.+\\.(ts|tsx)$": [
          "ts-jest",
          {
            tsconfig: {
              noEmit: false,
              module: "commonjs",
              esModuleInterop: true,
              isolatedModules: true,
              jsx: "react-jsx",
            },
          },
        ],
      },
    },
  ],
};

