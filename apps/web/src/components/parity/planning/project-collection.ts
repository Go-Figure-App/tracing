import type { getProjectPlans } from "@/fetchers/parity/projects";

export type ProjectSummary = Awaited<
  ReturnType<typeof getProjectPlans>
>["items"][number];
export type ProjectOrder = "name" | "priority" | "targetDate" | "progress";
export type ProjectGrouping = "none" | "status" | "lead";
export type ProjectColumn =
  | "health"
  | "priority"
  | "lead"
  | "targetDate"
  | "progress"
  | "status";
export const projectColumns: ProjectColumn[] = [
  "health",
  "priority",
  "lead",
  "targetDate",
  "progress",
  "status",
];
const priorityOrder = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  "no-priority": 4,
};

export function selectProjects(
  projects: ProjectSummary[],
  search: string,
  status: string,
  order: ProjectOrder,
  locale?: string,
) {
  const term = search.trim().toLocaleLowerCase(locale);
  return projects
    .filter(
      (project) =>
        (!status || project.status === status) &&
        (!term ||
          `${project.name} ${project.slug} ${project.leadName ?? ""}`
            .toLocaleLowerCase(locale)
            .includes(term)),
    )
    .sort((a, b) => {
      let result = 0;
      if (order === "priority")
        result = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (order === "targetDate")
        result = (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999");
      if (order === "progress")
        result =
          (b.progress.pointsPercent ?? b.progress.percent) -
          (a.progress.pointsPercent ?? a.progress.percent);
      return (
        result ||
        a.name.localeCompare(b.name, locale, { numeric: true }) ||
        a.id.localeCompare(b.id)
      );
    });
}
