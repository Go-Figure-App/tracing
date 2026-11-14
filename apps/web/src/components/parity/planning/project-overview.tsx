import { FavoriteButton } from "../views/favorite-button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { MarkdownRenderer } from "@/components/public-project/markdown-renderer";
import { Button } from "@/components/ui/button";
import { getProjectPlan } from "@/fetchers/parity/projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { HealthBadge } from "./health-badge";
import { usePlanningLabels } from "./labels";
import { Milestones } from "./milestones";
import { ProjectEditor } from "./project-editor";
import { ProgressMeter } from "./progress-meter";
import { usePlanningEnabled } from "./queries";
import { UpdateFeed } from "./update-feed";
import { ReportPanel } from "../insights/report-panel";
import icons from "@/constants/project-icons";
import { PlanningStatusIcon } from "./status-icon";
import { ProjectInitiatives } from "./project-initiatives";

export function ProjectOverview({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const labels = usePlanningLabels();
  const enabled = usePlanningEnabled("projects");
  const { canUpdateProjects } = useWorkspacePermission();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ["parity", "project-plan", projectId],
    queryFn: () => getProjectPlan(projectId),
    enabled,
  });
  const project = query.isError ? undefined : query.data;
  const Icon = icons[project?.icon as keyof typeof icons] ?? icons.Box;
  const date = (value: string | null) =>
    value
      ? formatDateMedium(new Date(`${value}T12:00:00`))
      : t("parity:planning.noDate");
  return (
    <ProjectLayout
      workspaceId={workspaceId}
      projectId={projectId}
      showViewSwitcher={false}
      summary={
        <Link
          to="/dashboard/workspace/$workspaceId/project/$projectId/board"
          params={{ workspaceId, projectId }}
          className="rounded-full px-3 py-1.5 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("parity:cycles.tasks")}
        </Link>
      }
    >
      <PageTitle
        title={
          project
            ? `${project.name} · ${t("parity:planning.overview")}`
            : t("parity:planning.overview")
        }
      />
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-10">
          {!enabled ? (
            <p>{t("parity:planning.unavailable")}</p>
          ) : query.isPending ? (
            <p role="status">{t("parity:planning.loading")}</p>
          ) : query.error ? (
            <div role="alert">
              {query.error.message}
              <Button variant="ghost" onClick={() => query.refetch()}>
                {t("parity:planning.retry")}
              </Button>
            </div>
          ) : (
            project && (
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="mx-auto w-full max-w-3xl min-w-0 space-y-8">
                  <header className="space-y-4">
                    <div className="flex items-start gap-3">
                      <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold tracking-tight">
                        <Icon
                          aria-hidden="true"
                          className="mb-4 size-8 rounded-lg bg-muted p-1.5 text-muted-foreground"
                        />
                        {project.name}
                      </h1>
                      <FavoriteButton
                        workspaceId={workspaceId}
                        kind="project"
                        targetId={projectId}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
                        <PlanningStatusIcon status={project.status} />
                        {labels.status[project.status]}
                      </span>
                      <HealthBadge health={project.health} />
                    </div>
                    <ProjectInitiatives
                      workspaceId={workspaceId}
                      projectId={projectId}
                    />
                    <h2 className="pt-3 text-xs font-medium text-muted-foreground">
                      {t("parity:planning.description")}
                    </h2>
                    {project.description ? (
                      <MarkdownRenderer content={project.description} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("parity:planning.noDescription")}
                      </p>
                    )}
                  </header>

                  <Milestones
                    projectId={projectId}
                    milestones={project.milestones}
                    canUpdate={canUpdateProjects()}
                  />
                  <UpdateFeed
                    key={projectId}
                    parentType="project"
                    parentId={projectId}
                    canUpdate={canUpdateProjects()}
                    initialHealth={project.health}
                  />
                </div>
                <aside className="min-w-0 space-y-6 lg:border-l lg:pl-6">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-medium">
                      {t("parity:planning.properties")}
                    </h2>
                    {canUpdateProjects() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditing(true)}
                      >
                        {t("parity:planning.editProperties")}
                      </Button>
                    )}
                  </div>
                  <ProgressMeter progress={project.progress} />
                  <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-4 text-xs [&_dd]:break-words">
                    <dt className="text-muted-foreground">
                      {t("parity:planning.lead")}
                    </dt>
                    <dd>{project.leadName ?? t("parity:planning.noLead")}</dd>
                    <dt className="text-muted-foreground">
                      {t("parity:planning.startDate")}
                    </dt>
                    <dd>{date(project.startDate)}</dd>
                    <dt className="text-muted-foreground">
                      {t("parity:planning.targetDate")}
                    </dt>
                    <dd>{date(project.targetDate)}</dd>
                    <dt className="text-muted-foreground">
                      {t("parity:planning.priority")}
                    </dt>
                    <dd>{labels.priority[project.priority]}</dd>
                  </dl>
                  <ReportPanel
                    workspaceId={workspaceId}
                    query={{ measure: "created-completed", projectId }}
                    title={t("parity:insights.projectProgress")}
                  />
                </aside>
                {editing && (
                  <ProjectEditor
                    project={project}
                    onClose={() => setEditing(false)}
                  />
                )}
              </div>
            )
          )}
        </div>
      </div>
    </ProjectLayout>
  );
}
