import { expect, it } from "vite-plus/test";
import { selectProjects, type ProjectSummary } from "./project-collection";

function project(
  id: string,
  values: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id,
    workspaceId: "workspace",
    name: id,
    slug: id,
    icon: null,
    description: null,
    status: "backlog",
    health: "on_track",
    leadId: null,
    leadName: null,
    startDate: null,
    targetDate: null,
    priority: "no-priority",
    latestUpdate: null,
    progress: {
      completed: 0,
      total: 0,
      percent: 0,
      completedPoints: null,
      totalPoints: null,
      pointsPercent: null,
    },
    ...values,
  };
}
it("combines status and case-insensitive name, slug and lead search without mutating the source", () => {
  const rows = [
    project("B", { name: "Release", status: "started", leadName: "Alex" }),
    project("A", { name: "Release", status: "planned" }),
  ];
  expect(
    selectProjects(rows, "  ALEX ", "started", "name", "en").map((p) => p.id),
  ).toEqual(["B"]);
  expect(selectProjects(rows, "a", "started", "name", "en")).toHaveLength(1);
  expect(selectProjects(rows, "", "completed", "name", "en")).toEqual([]);
  selectProjects(rows, "", "", "name", "en");
  expect(rows.map((p) => p.id)).toEqual(["B", "A"]);
});
it("orders urgent work first, missing dates last and point-based progress consistently", () => {
  const a = project("A", { priority: "urgent", targetDate: "2030-02-01" });
  const b = project("B", { priority: "high", targetDate: "2030-01-01" });
  const c = project("C");
  a.progress = { ...a.progress, percent: 90, pointsPercent: 10 };
  b.progress = { ...b.progress, percent: 50 };
  const rows = [c, b, a];
  expect(selectProjects(rows, "", "", "priority").map((p) => p.id)).toEqual([
    "A",
    "B",
    "C",
  ]);
  expect(selectProjects(rows, "", "", "targetDate").map((p) => p.id)).toEqual([
    "B",
    "A",
    "C",
  ]);
  expect(selectProjects(rows, "", "", "progress").map((p) => p.id)).toEqual([
    "B",
    "A",
    "C",
  ]);
});
