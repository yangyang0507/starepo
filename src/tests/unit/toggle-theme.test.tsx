import { render, waitFor } from "@testing-library/react";
import { test, expect } from "vitest";
import ToggleTheme from "@/components/toggle-theme";
import React from "react";

test("renders ToggleTheme", async () => {
  const { getByRole } = render(<ToggleTheme />);
  
  await waitFor(() => {
    const button = getByRole("button");
    expect(button).toBeInTheDocument();
  });
});

test("displays theme text", async () => {
  const { getByRole } = render(<ToggleTheme />);
  
  await waitFor(() => {
    const button = getByRole("button");
    // Should contain system theme emoji and text (default)
    expect(button.textContent).toContain("💻");
    expect(button.textContent).toContain("系统");
  });
});

test("button is not disabled when loaded", async () => {
  const { getByRole } = render(<ToggleTheme />);
  
  await waitFor(() => {
    const button = getByRole("button");
    expect(button).not.toBeDisabled();
  });
});
