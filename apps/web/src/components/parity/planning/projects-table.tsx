import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import icons from "@/constants/project-icons";
import { formatDateMedium } from "@/lib/format";
import { getPriorityIcon } from "@/lib/priority";
import { HealthBadge } from "./health-badge";
import { projectStatuses, usePlanningLabels } from "./labels";
import {
  projectColumns,
  type ProjectColumn,
  type ProjectGrouping,
  type ProjectSummary,
} from "./project-collection";
import { PlanningStatusIcon } from "./status-icon";

export function ProjectsTable({
  projects,
  columns = projectColumns,
  groupBy = "none",
  actions,
}: {
  projects: ProjectSummary[];
  columns?: ProjectColumn[];
  groupBy?: ProjectGrouping;
  actions?: (project: ProjectSummary) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const labels = usePlanningLabels();
  const visible = projectColumns.filter((column) => columns.includes(column));
  const groupKeys =
    groupBy === "status"
      ? [...projectStatuses]
      : groupBy === "lead"
        ? [...new Set(projects.map((project) => project.leadId ?? ""))]
        : [""];
  const groups = groupKeys
    .map((key) => ({
      key,
      projects: projects.filter((project) =>
        groupBy === "status"
          ? project.status === key
          : groupBy === "lead"
            ? (project.leadId ?? "") === key
            : true,
      ),
    }))
    .filter((group) => group.projects.length);
  const number = new Intl.NumberFormat(i18n.language);
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full table-fixed text-left text-[13px]"
        style={{ minWidth: 320 + visible.length * 128 }}
      >
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="min-w-64 px-5 py-3 font-normal">
              {t("parity:planning.name")}
            </th>
            {visible.map((column) => (
              <th
                key={column}
                scope="col"
                className={`px-3 py-3 font-normal ${column === "priority" ? "w-20" : column === "lead" ? "w-32" : "w-36"}`}
              >
                {t(`parity:planning.${column}`)}
              </th>
            ))}
            {actions && (
              <th scope="col" className="w-10">
                <span className="sr-only">{t("parity:planning.more")}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              {groupBy !== "none" && (
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={visible.length + 1 + (actions ? 1 : 0)}
                    className="bg-muted/45 px-5 py-2 text-xs font-medium"
                  >
                    <div className="flex items-center gap-2">
                      {groupBy === "status" && (
                        <PlanningStatusIcon status={group.key} />
                      )}
                      {groupBy === "status"
                        ? labels.status[group.key as keyof typeof labels.status]
                        : (group.projects[0].leadName ??
                          t("parity:planning.noLead"))}
                      <span className="font-normal text-muted-foreground">
                        {number.format(group.projects.length)}
                      </span>
                    </div>
                  </th>
                </tr>
              )}
              {group.projects.map((project) => {
                const Icon =
                  icons[project.icon as keyof typeof icons] ?? icons.Box;
                const percent =
                  project.progress.pointsPercent ?? project.progress.percent;
                return (
                  <tr
                    key={project.id}
                    className="group h-12 border-b border-border/40 transition-colors last:border-0 hover:bg-accent/40 focus-within:bg-accent/40"
                  >
                    <td className="px-5 py-2">
                      <Link
                        className="flex min-w-52 items-center gap-2.5 rounded-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        to="/dashboard/workspace/$workspaceId/project/$projectId/overview"
                        params={{
                          workspaceId: project.workspaceId,
                          projectId: project.id,
                        }}
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate" title={project.name}>
                          {project.name}
                        </span>
                      </Link>
                    </td>
                    {visible.map((column) => (
                      <td key={column} className="px-3 py-2 text-xs">
                        {column === "status" && (
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <PlanningStatusIcon status={project.status} />
                            {labels.status[project.status]}
                          </span>
                        )}
                        {column === "health" && (
                          <HealthBadge health={project.health} />
                        )}
                        {column === "priority" && (
                          <span
                            className="inline-flex"
                            title={labels.priority[project.priority]}
                          >
                            <span aria-hidden="true">
                              {getPriorityIcon(project.priority)}
                            </span>
                            <span className="sr-only">
                              {labels.priority[project.priority]}
                            </span>
                          </span>
                        )}
                        {column === "lead" && (
                          <span
                            className="flex items-center gap-2"
                            title={
                              project.leadName ?? t("parity:planning.noLead")
                            }
                          >
                            <UserRound
                              aria-hidden="true"
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                            <span className="truncate">
                              {project.leadName ?? t("parity:planning.noLead")}
                            </span>
                          </span>
                        )}
                        {column === "targetDate" && (
                          <span className="whitespace-nowrap text-muted-foreground">
                            {project.targetDate ? (
                              formatDateMedium(
                                new Date(`${project.targetDate}T12:00:00`),
                              )
                            ) : (
                              <span aria-label={t("parity:planning.noDate")}>
                                —
                              </span>
                            )}
                          </span>
                        )}
                        {column === "progress" && (
                          <div
                            className="flex items-center gap-2.5"
                            title={t(
                              "parity:planning.completed",
                              project.progress,
                            )}
                          >
                            <div
                              role="progressbar"
                              aria-label={t("parity:planning.progress")}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={percent}
                              className="h-1 w-16 overflow-hidden rounded-full bg-muted"
                            >
                              <div
                                className="h-full rounded-full bg-primary/70"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-muted-foreground">
                              {number.format(percent)}%
                            </span>
                          </div>
                        )}
                      </td>
                    ))}
                    {actions && <td className="pr-2">{actions(project)}</td>}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
