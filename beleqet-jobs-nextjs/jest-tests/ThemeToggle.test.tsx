/**
 * @file ThemeToggle.test.tsx
 * Jest unit tests for components/ThemeToggle.tsx
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockSetTheme = jest.fn();
let mockResolvedTheme = "light";

jest.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

import ThemeToggle from "@/components/ThemeToggle";

beforeEach(() => {
  jest.clearAllMocks();
  mockResolvedTheme = "light";
});

describe("ThemeToggle", () => {
  test("renders a button after mount", async () => {
    await act(async () => { render(<ThemeToggle />); });
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  test("shows 'Switch to dark mode' label in light mode", async () => {
    mockResolvedTheme = "light";
    await act(async () => { render(<ThemeToggle />); });
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Switch to dark mode");
  });

  test("shows 'Switch to light mode' label in dark mode", async () => {
    mockResolvedTheme = "dark";
    await act(async () => { render(<ThemeToggle />); });
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Switch to light mode");
  });

  test("calls setTheme('dark') when clicked in light mode", async () => {
    mockResolvedTheme = "light";
    await act(async () => { render(<ThemeToggle />); });
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  test("calls setTheme('light') when clicked in dark mode", async () => {
    mockResolvedTheme = "dark";
    await act(async () => { render(<ThemeToggle />); });
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  test("button title matches aria-label", async () => {
    mockResolvedTheme = "light";
    await act(async () => { render(<ThemeToggle />); });
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("title")).toBe(btn.getAttribute("aria-label"));
  });
});
