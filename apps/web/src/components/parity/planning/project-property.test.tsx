import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { updateProjectPlan } from "@/fetchers/parity/projects";
import getProjectMembers from "@/fetchers/workspace-user/get-project-members";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { ProjectProperty } from "./project-property";
import type { ProjectSummary } from "./project-collection";
vi.mock("@/fetchers/parity/projects", () => ({ updateProjectPlan: vi.fn() }));
vi.mock("@/fetchers/workspace-user/get-project-members", () => ({
  default: vi.fn(),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: vi.fn(),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
const project: ProjectSummary = {
  id: "project",
  workspaceId: "workspace",
  name: "Project",
  slug: "project",
  icon: null,
  description: null,
  status: "planned",
  priority: "high",
  health: "on_track",
  leadId: "one",
  leadName: "Alex",
  startDate: "2030-01-01",
  targetDate: "2030-02-01",
  latestUpdate: null,
  progress: {
    total: 3,
    completed: 1,
    percent: 33,
    totalPoints: null,
    completedPoints: null,
    pointsPercent: null,
  },
};
function mount(field: "status" | "priority" | "leadId" | "targetDate") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <ProjectProperty project={project} field={field} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.mocked(useWorkspacePermission).mockReturnValue({
    canUpdateProjects: () => true,
  } as ReturnType<typeof useWorkspacePermission>);
  vi.mocked(updateProjectPlan).mockResolvedValue(
    {} as Awaited<ReturnType<typeof updateProjectPlan>>,
  );
  vi.mocked(getProjectMembers).mockResolvedValue([
    { id: "one", name: "Alex" },
  ] as Awaited<ReturnType<typeof getProjectMembers>>);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("changes only the selected property, preserving concurrent changes to other fields", async () => {
  mount("status");
  fireEvent.click(
    screen.getByRole("button", { name: /parity:planning.status:/ }),
  );
  fireEvent.change(
    screen.getByLabelText("parity:planning.status", { exact: true }),
    {
      target: { value: "started" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "parity:planning.save" }));
  await waitFor(() =>
    expect(updateProjectPlan).toHaveBeenCalledWith("project", {
      status: "started",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  expect(getProjectMembers).not.toHaveBeenCalled();
});
it("loads members only on opening the lead control and supports unassigning", async () => {
  mount("leadId");
  expect(getProjectMembers).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: /parity:planning.lead:/ }),
  );
  await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "parity:planning.save" }));
  await waitFor(() =>
    expect(updateProjectPlan).toHaveBeenCalledWith("project", { leadId: null }),
  );
});
it("clears dates with an explicit null", async () => {
  mount("targetDate");
  fireEvent.click(
    screen.getByRole("button", { name: /parity:planning.targetDate:/ }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "parity:planning.clear" }),
  );
  await waitFor(() =>
    expect(updateProjectPlan).toHaveBeenCalledWith("project", {
      targetDate: null,
    }),
  );
});
it("keeps failed edits open with an actionable error", async () => {
  vi.mocked(updateProjectPlan).mockRejectedValue(
    new Error("Permission changed"),
  );
  mount("priority");
  fireEvent.click(
    screen.getByRole("button", { name: /parity:planning.priority:/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "parity:planning.save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Permission changed",
  );
  expect(screen.getByRole("combobox")).toBeVisible();
});
it("renders read-only values without write controls when project updates are forbidden", () => {
  vi.mocked(useWorkspacePermission).mockReturnValue({
    canUpdateProjects: () => false,
  } as ReturnType<typeof useWorkspacePermission>);
  mount("leadId");
  expect(screen.getByText("Alex")).toBeVisible();
  expect(screen.queryByRole("button")).toBeNull();
  expect(getProjectMembers).not.toHaveBeenCalled();
});

it("keeps a pending save locked and preserves its error when dismissal is attempted", async () => {
  let fail!: (error: Error) => void;
  vi.mocked(updateProjectPlan).mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  mount("priority");
  const trigger = screen.getByRole("button", {
    name: /parity:planning.priority:/,
  });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "parity:planning.save" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "parity:planning.save" }),
    ).toBeDisabled(),
  );
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  fireEvent.click(trigger);
  expect(screen.getByRole("combobox")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "parity:planning.save" }),
  ).toBeDisabled();
  expect(updateProjectPlan).toHaveBeenCalledTimes(1);
  await act(async () => fail(new Error("Save rejected")));
  expect(await screen.findByRole("alert")).toHaveTextContent("Save rejected");
});
