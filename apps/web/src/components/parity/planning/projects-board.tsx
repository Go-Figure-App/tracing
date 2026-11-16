import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import icons from "@/constants/project-icons";
import { projectStatuses, usePlanningLabels } from "./labels";
import { HealthBadge } from "./health-badge";
import { PlanningStatusIcon } from "./status-icon";
import { ProjectProperty } from "./project-property";
import type { ProjectColumn, ProjectSummary } from "./project-collection";
export function ProjectsBoard({
  projects,
  columns,
  status,
}: {
  projects: ProjectSummary[];
  columns: ProjectColumn[];
  status: string;
}) {
  const { t, i18n } = useTranslation();
  const labels = usePlanningLabels();
  const number = new Intl.NumberFormat(i18n.language);
  return (
    <div className="flex h-full items-start gap-5 overflow-auto px-5 py-3">
      {projectStatuses
        .filter((value) => !status || value === status)
        .map((value) => {
          const items = projects.filter((project) => project.status === value);
          return (
            <section
              key={value}
              aria-label={labels.status[value]}
              className="w-72 shrink-0 space-y-3"
            >
              <h2 className="flex items-center gap-2 px-1 text-xs font-medium">
                <PlanningStatusIcon status={value} />
                {labels.status[value]}
                <span className="text-muted-foreground">
                  {number.format(items.length)}
                </span>
              </h2>
              {items.map((project) => {
                const Icon =
                  icons[project.icon as keyof typeof icons] ?? icons.Box;
                return (
                  <article
                    key={project.id}
                    className="space-y-3 rounded-lg border border-border/70 bg-card p-3 shadow-xs"
                  >
                    <Link
                      to="/dashboard/workspace/$workspaceId/project/$projectId/overview"
                      params={{
                        workspaceId: project.workspaceId,
                        projectId: project.id,
                      }}
                      className="flex items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">{project.name}</span>
                    </Link>
                    {columns.includes("health") && (
                      <HealthBadge
                        health={project.latestUpdate ? project.health : null}
                      />
                    )}
                    <div className="flex flex-wrap gap-1">
                      {columns.includes("status") && (
                        <ProjectProperty project={project} field="status" />
                      )}
                      {columns.includes("priority") && (
                        <ProjectProperty
                          project={project}
                          field="priority"
                          compact
                        />
                      )}
                      {columns.includes("lead") && (
                        <ProjectProperty
                          project={project}
                          field="leadId"
                          compact
                        />
                      )}
                      {columns.includes("targetDate") && (
                        <ProjectProperty project={project} field="targetDate" />
                      )}
                    </div>
                    {(columns.includes("issues") ||
                      columns.includes("progress")) && (
                      <p className="text-xs text-muted-foreground">
                        {t("parity:planning.completed", project.progress)}
                      </p>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}
    </div>
  );
}
