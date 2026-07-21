/**
 * @file __tests__/components/mobile/MobileBottomNav.test.tsx
 * @description Unit tests for the {@link MobileBottomNav} component.
 *
 * Covers:
 * - Renders all five tab buttons.
 * - Highlights the active tab based on the current pathname.
 * - Filters out auth-required tabs when user is not authenticated.
 * - Applies correct ARIA attributes for accessibility.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Mock next/navigation to control `usePathname`.
 */
const mockUsePathname = jest.fn().mockReturnValue("/jobs");
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ replace: jest.fn() }),
}));

/**
 * Mock the AuthProvider to control authentication state.
 */
const mockUseAuth = jest.fn().mockReturnValue({
  user: { id: "1", email: "a@b.com", firstName: "A", lastName: "B", role: "JOB_SEEKER" },
  ready: true,
  logout: jest.fn(),
});
jest.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/**
 * Mock the i18n provider and hook.
 */
const mockT = jest.fn((key: string) => key);
jest.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: mockT,
    locale: "en",
    setLocale: jest.fn(),
  }),
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ------------------------------------------------------------------ */
/*  Import component after mocks are set up                            */
/* ------------------------------------------------------------------ */

import MobileBottomNav from "@/components/mobile/MobileBottomNav";

/* ------------------------------------------------------------------ */
/*  Test suite                                                         */
/* ------------------------------------------------------------------ */

describe("MobileBottomNav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/jobs");
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "a@b.com", firstName: "A", lastName: "B", role: "JOB_SEEKER" },
      ready: true,
      logout: jest.fn(),
    });
  });

  /**
   * Renders the component with all required providers.
   */
  function renderWithProviders() {
    return render(
      <React.Fragment>
        <MobileBottomNav />
      </React.Fragment>,
    );
  }

  it("renders the navigation bar with role 'navigation'", () => {
    renderWithProviders();
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(nav).toBeInTheDocument();
  });

  it("renders all five tabs when user is authenticated", () => {
    renderWithProviders();
    /* Verify key links exist (translated labels are just the key strings). */
    expect(screen.getByLabelText("nav.findJobs")).toBeInTheDocument();
    expect(screen.getByLabelText("nav.dashboard")).toBeInTheDocument();
    expect(screen.getByLabelText("action.postJob")).toBeInTheDocument();
    expect(screen.getByLabelText("nav.applications")).toBeInTheDocument();
    expect(screen.getByLabelText("nav.profile")).toBeInTheDocument();
  });

  it("highlights the active tab with aria-current='page'", () => {
    mockUsePathname.mockReturnValue("/jobs");
    renderWithProviders();
    const activeLink = screen.getByLabelText("nav.findJobs");
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("does not highlight a non-active tab", () => {
    mockUsePathname.mockReturnValue("/jobs");
    renderWithProviders();
    const inactiveLink = screen.getByLabelText("nav.profile");
    expect(inactiveLink).not.toHaveAttribute("aria-current");
  });

  it("filters out auth-required tabs when user is unauthenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      ready: true,
      logout: jest.fn(),
    });
    renderWithProviders();
    /* Only "Find Jobs" (no auth required) should remain. */
    expect(screen.getByLabelText("nav.findJobs")).toBeInTheDocument();
    expect(screen.queryByLabelText("nav.dashboard")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("action.postJob")).not.toBeInTheDocument();
  });

  it("renders tab links with correct hrefs", () => {
    renderWithProviders();
    const jobsLink = screen.getByLabelText("nav.findJobs").closest("a");
    expect(jobsLink).toHaveAttribute("href", "/jobs");

    const dashboardLink = screen.getByLabelText("nav.dashboard").closest("a");
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });
});