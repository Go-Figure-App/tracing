import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getProjectPlan } from "@/fetchers/parity/projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { Milestones } from "./milestones";
import { ProgressMeter } from "./progress-meter";
import { ProjectProperty, type ProjectPropertyField } from "./project-property";
import { ProjectInitiatives } from "./project-initiatives";
import { ReportPanel } from "../insights/report-panel";

export function ProjectDetails({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { canUpdateProjects } = useWorkspacePermission();
  const query = useQuery({
    queryKey: ["parity", "project-plan", projectId],
    queryFn: () => getProjectPlan(projectId),
  });
  if (query.isPending)
    return (
      <p role="status" className="p-4 text-xs">
        {t("parity:planning.loading")}
      </p>
    );
  if (query.isError)
    return (
      <div role="alert" className="p-4 text-xs">
        {query.error.message}
        <Button variant="ghost" onClick={() => query.refetch()}>
          {t("parity:planning.retry")}
        </Button>
      </div>
    );
  const project = query.data;
  const fields: ProjectPropertyField[] = [
    "status",
    "priority",
    "leadId",
    "startDate",
    "targetDate",
  ];
  return (
    <div className="divide-y divide-border/60 text-xs">
      <details open className="p-4">
        <summary className="cursor-pointer font-medium">
          {t("parity:planning.properties")}
        </summary>
        <dl className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
          {fields.map((field) => (
            <div key={field} className="contents">
              <dt className="text-muted-foreground">
                {t(`parity:planning.${field === "leadId" ? "lead" : field}`)}
              </dt>
              <dd className="min-w-0">
                <ProjectProperty project={project} field={field} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <ProjectInitiatives workspaceId={workspaceId} projectId={projectId} />
        </div>
      </details>
      <details open className="p-4">
        <summary className="cursor-pointer font-medium">
          {t("parity:planning.milestones")}
        </summary>
        <div className="mt-4">
          <Milestones
            compact
            projectId={projectId}
            milestones={project.milestones}
            canUpdate={canUpdateProjects()}
          />
        </div>
      </details>
      <details open className="p-4">
        <summary className="cursor-pointer font-medium">
          {t("parity:planning.progress")}
        </summary>
        <div className="mt-4 space-y-6">
          <ProgressMeter progress={project.progress} />
          <ReportPanel
            workspaceId={workspaceId}
            query={{ measure: "created-completed", projectId }}
            title={t("parity:insights.projectProgress")}
          />
        </div>
      </details>
    </div>
  );
}
