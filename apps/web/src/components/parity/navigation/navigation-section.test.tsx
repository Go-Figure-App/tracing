import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { NavigationSection } from "./navigation-section";
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
it("collapses accessibly and remembers the choice for this workspace across remounts", () => {
  const renderSection = () =>
    render(
      <NavigationSection title="Workspace" storageKey="test:workspace">
        <a href="/projects">Projects</a>
      </NavigationSection>,
    );
  const view = renderSection();
  fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
  expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("link")).toBeNull();
  view.unmount();
  renderSection();
  expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("link")).toBeVisible();
});
it("continues working when browser preference storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Disabled");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Disabled");
  });
  render(
    <NavigationSection title="Workspace" storageKey="test:workspace">
      Projects
    </NavigationSection>,
  );
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
});
