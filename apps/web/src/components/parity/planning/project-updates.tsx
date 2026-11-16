import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { getProjectPlan } from "@/fetchers/parity/projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { usePlanningEnabled } from "./queries";
import { UpdateFeed } from "./update-feed";
export function ProjectUpdates({
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
  return (
    <ProjectLayout
      workspaceId={workspaceId}
      projectId={projectId}
      showViewSwitcher={false}
    >
      <PageTitle title={t("parity:planning.updates")} />
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl p-5 sm:p-10">
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
            <UpdateFeed
              key={projectId}
              parentType="project"
              parentId={projectId}
              canUpdate={canUpdateProjects()}
              initialHealth={query.data.health}
            />
          )}
        </div>
      </div>
    </ProjectLayout>
  );
}
