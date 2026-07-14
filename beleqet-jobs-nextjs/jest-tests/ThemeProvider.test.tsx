/**
 * @file ThemeProvider.test.tsx
 * Jest unit tests for components/ThemeProvider.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// Mock next-themes and capture forwarded props
let capturedProps: Record<string, unknown> = {};
jest.mock("next-themes", () => ({
  ThemeProvider: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <>{props.children}</>;
  },
}));

import { ThemeProvider } from "@/components/ThemeProvider";

beforeEach(() => { capturedProps = {}; });

describe("ThemeProvider", () => {
  test("renders children without crashing", () => {
    render(
      <ThemeProvider>
        <span data-testid="child">hello</span>
      </ThemeProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  test("passes attribute='class' to next-themes", () => {
    render(<ThemeProvider><div /></ThemeProvider>);
    expect(capturedProps.attribute).toBe("class");
  });

  test("defaults to system theme", () => {
    render(<ThemeProvider><div /></ThemeProvider>);
    expect(capturedProps.defaultTheme).toBe("system");
  });

  test("enables system theme detection", () => {
    render(<ThemeProvider><div /></ThemeProvider>);
    expect(capturedProps.enableSystem).toBe(true);
  });

  test("persists theme under key 'beleqet-theme'", () => {
    render(<ThemeProvider><div /></ThemeProvider>);
    expect(capturedProps.storageKey).toBe("beleqet-theme");
  });

  test("allows overriding defaultTheme", () => {
    render(<ThemeProvider defaultTheme="dark"><div /></ThemeProvider>);
    expect(capturedProps.defaultTheme).toBe("dark");
  });
});
