import { render, screen } from "@testing-library/react";
import { Providers } from "../ThemeProvider";

describe("Providers (ThemeProvider)", () => {
  it("renders children inside the theme context", () => {
    render(
      <Providers>
        <p data-testid="child">Hello</p>
      </Providers>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });
});
