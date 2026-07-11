import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.css$": "<rootDir>/jest.css-stub.ts",
  },
  setupFilesAfterEnv: ["./jest.setup.ts"],
  testMatch: [
    "<rootDir>/**/__tests__/**/*.test.ts",
    "<rootDir>/**/__tests__/**/*.test.tsx",
  ],
};

export default config;
