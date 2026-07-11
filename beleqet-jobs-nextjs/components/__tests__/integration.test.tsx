/**
 * Integration tests verifying the theme module connects correctly with the
 * existing system (next-themes, localStorage persistence, global state).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { useTheme, ThemeProvider } from "next-themes";
import ThemeToggle from "../ThemeToggle";

/** Renders ThemeToggle inside the real next-themes Provider. */
function renderWithRealProvider() {
  return render(
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeToggle />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("Theme integration (real next-themes Provider)", () => {
  it("renders the toggle without crashing inside the real provider", async () => {
    renderWithRealProvider();
    const button = await screen.findByRole("button", { name: /select theme/i });
    expect(button).toBeInTheDocument();
  });

  it("persists the selected theme to localStorage", async () => {
    renderWithRealProvider();

    const button = await screen.findByRole("button", { name: /select theme/i });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("option", { name: /dark/i }));

    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("applies the .dark class to <html> when dark is selected", async () => {
    renderWithRealProvider();

    const button = await screen.findByRole("button", { name: /select theme/i });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("option", { name: /dark/i }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes the .dark class when switching back to light", async () => {
    renderWithRealProvider();

    const button = await screen.findByRole("button", { name: /select theme/i });

    // switch to dark
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("option", { name: /dark/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // switch back to light
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("option", { name: /light/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reads an existing preference from localStorage on mount", () => {
    localStorage.setItem("theme", "dark");

    renderWithRealProvider();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("exposes the current theme via useTheme() for other components", () => {
    function Consumer() {
      const { theme } = useTheme();
      return <span data-testid="consumer-theme">{theme}</span>;
    }

    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <Consumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("consumer-theme")).toHaveTextContent("light");
  });

  it("defaults to system preference when no localStorage value exists", () => {
    localStorage.clear();

    function Consumer() {
      const { theme, resolvedTheme } = useTheme();
      return (
        <>
          <span data-testid="stored-theme">{theme}</span>
          <span data-testid="resolved-theme">{resolvedTheme}</span>
        </>
      );
    }

    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Consumer />
      </ThemeProvider>,
    );

    // 'theme' should be "system" (the default, no explicit choice made)
    expect(screen.getByTestId("stored-theme")).toHaveTextContent("system");
    // 'resolvedTheme' should be "light" or "dark" (from jsdom matchMedia mock)
    expect(["light", "dark"]).toContain(
      screen.getByTestId("resolved-theme").textContent,
    );
  });
});
