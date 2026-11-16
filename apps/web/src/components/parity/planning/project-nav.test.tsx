import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ProjectPlanningNav } from "./project-nav";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const route = vi.hoisted(() => ({
  pathname: "/dashboard/workspace/workspace/project/project/overview",
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => route,
  Link: ({
    children,
    to,
    params = {},
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      href={to.replace(/\$(\w+)/g, (_, key: string) => params[key])}
    >
      {children}
    </a>
  ),
}));
afterEach(cleanup);

function renderNav(features: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  client.setQueryData(["parity", "features"], { features });
  render(
    <QueryClientProvider client={client}>
      <ProjectPlanningNav workspaceId="workspace" projectId="project" />
    </QueryClientProvider>,
  );
}
it("keeps the original navigation when project planning is disabled", () => {
  renderNav([]);
  expect(screen.queryByRole("link")).toBeNull();
});
it("links the current project's overview when planning is enabled", () => {
  renderNav(["foundation", "projects"]);
  expect(
    screen.getByRole("link", { name: "parity:planning.overview" }),
  ).toHaveAttribute(
    "href",
    "/dashboard/workspace/workspace/project/project/overview",
  );
});

it("shares Overview, Updates and Issues tabs and identifies the current section", () => {
  route.pathname = "/dashboard/workspace/workspace/project/project/updates";
  renderNav(["projects"]);
  expect(screen.getAllByRole("link")).toHaveLength(3);
  expect(
    screen.getByRole("link", { name: "parity:planning.updates" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    screen.getByRole("link", { name: "parity:cycles.tasks" }),
  ).toHaveAttribute(
    "href",
    "/dashboard/workspace/workspace/project/project/board",
  );
  expect(
    screen.getByRole("link", { name: "parity:planning.overview" }),
  ).not.toHaveAttribute("aria-current");
});
