import { ProjectTeamPicker } from "../teams/project-team-picker";
import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { usePlanningEnabled } from "./queries";
import { ProjectProperty } from "./project-property";
import { useTranslation } from "react-i18next";
import icons from "@/constants/project-icons";
import { HealthBadge } from "./health-badge";
import { projectStatuses, usePlanningLabels } from "./labels";
import {
  projectColumns,
  defaultProjectColumns,
  type ProjectOrder,
  type ProjectColumn,
  type ProjectGrouping,
  type ProjectSummary,
} from "./project-collection";
import { PlanningStatusIcon } from "./status-icon";

export function ProjectsTable({
  projects,
  columns = defaultProjectColumns,
  groupBy = "none",
  actions,
  orderBy,
  onOrderChange,
}: {
  projects: ProjectSummary[];
  columns?: ProjectColumn[];
  groupBy?: ProjectGrouping;
  actions?: (project: ProjectSummary) => ReactNode;
  orderBy?: ProjectOrder;
  onOrderChange?: (order: ProjectOrder) => void;
}) {
  const { t, i18n } = useTranslation();
  const labels = usePlanningLabels();
  const teamsEnabled = usePlanningEnabled("teams");
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
  const number = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 0,
  });
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full table-fixed text-left text-[13px]"
        style={{
          minWidth: teamsEnabled
            ? 260 +
              visible.reduce(
                (width, column) =>
                  width +
                  (["priority", "lead", "issues"].includes(column) ? 80 : 144),
                0,
              ) +
              (actions ? 40 : 0)
            : 260 + visible.length * 92,
        }}
      >
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th
              scope="col"
              className="min-w-56 px-5 py-3 font-normal"
              aria-sort={orderBy === "name" ? "ascending" : undefined}
            >
              {onOrderChange ? (
                <button
                  className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onOrderChange("name")}
                >
                  {t("parity:planning.name")}
                </button>
              ) : (
                t("parity:planning.name")
              )}
            </th>
            {visible.map((column) => (
              <th
                key={column}
                scope="col"
                aria-sort={
                  orderBy === column
                    ? column === "progress"
                      ? "descending"
                      : "ascending"
                    : undefined
                }
                className={`px-3 py-3 font-normal ${column === "priority" || column === "lead" || column === "issues" ? "w-20" : "w-36"}`}
              >
                {onOrderChange &&
                (column === "priority" ||
                  column === "targetDate" ||
                  column === "progress") ? (
                  <button
                    className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onOrderChange(column)}
                  >
                    {t(`parity:planning.${column}`)}
                  </button>
                ) : (
                  t(`parity:planning.${column}`)
                )}
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
                    className="group h-12 transition-colors hover:bg-accent/40 focus-within:bg-accent/40"
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
                      <ProjectTeamPicker
                        workspaceId={project.workspaceId}
                        projectId={project.id}
                        teamId={project.teamId}
                      />
                    </td>
                    {visible.map((column) => (
                      <td key={column} className="px-3 py-2 text-xs">
                        {column === "status" && (
                          <div className="flex items-center gap-1">
                            <ProjectProperty
                              project={project}
                              field="status"
                              compact
                            />
                            <span
                              title={t(
                                "parity:planning.completed",
                                project.progress,
                              )}
                              className="tabular-nums text-muted-foreground"
                            >
                              {number.format(percent)}%
                            </span>
                          </div>
                        )}
                        {column === "health" && (
                          <HealthBadge
                            health={
                              project.latestUpdate ? project.health : null
                            }
                          />
                        )}
                        {column === "priority" && (
                          <ProjectProperty
                            project={project}
                            field="priority"
                            compact
                          />
                        )}
                        {column === "lead" && (
                          <ProjectProperty
                            project={project}
                            field="leadId"
                            compact
                          />
                        )}
                        {column === "targetDate" && (
                          <ProjectProperty
                            project={project}
                            field="targetDate"
                          />
                        )}
                        {column === "issues" && (
                          <span
                            className="tabular-nums text-muted-foreground"
                            title={t(
                              "parity:planning.completed",
                              project.progress,
                            )}
                          >
                            {number.format(project.progress.total)}
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
