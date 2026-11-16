import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { MarkdownRenderer } from "@/components/public-project/markdown-renderer";
import { Button } from "@/components/ui/button";
import icons from "@/constants/project-icons";
import { getProjectPlan } from "@/fetchers/parity/projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { Milestones } from "./milestones";
import { ProjectProperty, type ProjectPropertyField } from "./project-property";
import { ProjectInitiatives } from "./project-initiatives";
import { HealthBadge } from "./health-badge";
import { usePlanningEnabled } from "./queries";
export function ProjectOverview({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const enabled = usePlanningEnabled("projects");
  const { canUpdateProjects } = useWorkspacePermission();
  const query = useQuery({
    queryKey: ["parity", "project-plan", projectId],
    queryFn: () => getProjectPlan(projectId),
    enabled,
  });
  const project = query.isError ? undefined : query.data;
  const Icon = icons[project?.icon as keyof typeof icons] ?? icons.Box;
  const fields: ProjectPropertyField[] = [
    "status",
    "priority",
    "leadId",
    "startDate",
    "targetDate",
  ];
  return (
    <ProjectLayout
      workspaceId={workspaceId}
      projectId={projectId}
      showViewSwitcher={false}
    >
      <PageTitle
        title={
          project
            ? `${project.name} · ${t("parity:planning.overview")}`
            : t("parity:planning.overview")
        }
      />
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-10">
          {!enabled ? (
            <p>{t("parity:planning.unavailable")}</p>
          ) : query.isPending ? (
            <p role="status">{t("parity:planning.loading")}</p>
          ) : query.isError ? (
            <div role="alert">
              {query.error.message}
              <Button variant="ghost" onClick={() => query.refetch()}>
                {t("parity:planning.retry")}
              </Button>
            </div>
          ) : (
            project && (
              <div className="space-y-8">
                <header className="space-y-5">
                  <Icon
                    aria-hidden="true"
                    className="size-9 rounded-lg bg-muted p-1.5 text-muted-foreground"
                  />
                  <h1 className="break-words text-2xl font-semibold tracking-tight">
                    {project.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-1">
                    {fields.map((field) => (
                      <ProjectProperty
                        key={field}
                        project={project}
                        field={field}
                      />
                    ))}
                  </div>
                  <ProjectInitiatives
                    workspaceId={workspaceId}
                    projectId={projectId}
                  />
                </header>
                <Link
                  to="/dashboard/workspace/$workspaceId/project/$projectId/updates"
                  params={{ workspaceId, projectId }}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-4 text-sm hover:bg-accent/40"
                >
                  <span>{t("parity:planning.updates")}</span>
                  <HealthBadge
                    health={project.latestUpdate ? project.health : null}
                  />
                </Link>
                <section className="space-y-4">
                  <h2 className="text-sm font-medium">
                    {t("parity:planning.description")}
                  </h2>
                  {project.description ? (
                    <MarkdownRenderer content={project.description} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("parity:planning.noDescription")}
                    </p>
                  )}
                </section>
                <Milestones
                  projectId={projectId}
                  milestones={project.milestones}
                  canUpdate={canUpdateProjects()}
                />
              </div>
            )
          )}
        </div>
      </div>
    </ProjectLayout>
  );
}
