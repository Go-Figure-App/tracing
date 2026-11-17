import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { useProjectDetailsPreference } from "./use-project-details-preference";
beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("restores each workspace's preference when routes reuse the layout", () => {
  sessionStorage.setItem("tracing:project-details:second", "closed");
  const hook = renderHook(
    ({ workspaceId }) => useProjectDetailsPreference(workspaceId),
    { initialProps: { workspaceId: "first" } },
  );
  expect(hook.result.current[0]).toBe(true);
  hook.rerender({ workspaceId: "second" });
  expect(hook.result.current[0]).toBe(false);
  act(() => hook.result.current[1](true));
  expect(sessionStorage.getItem("tracing:project-details:second")).toBe("open");
  expect(sessionStorage.getItem("tracing:project-details:first")).toBeNull();
  act(() => hook.result.current[1](false));
  hook.rerender({ workspaceId: "first" });
  expect(hook.result.current[0]).toBe(true);
  hook.rerender({ workspaceId: "second" });
  expect(hook.result.current[0]).toBe(false);
});
