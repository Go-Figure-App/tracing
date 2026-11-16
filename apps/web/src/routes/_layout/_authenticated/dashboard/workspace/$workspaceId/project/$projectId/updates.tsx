import { createFileRoute } from "@tanstack/react-router";
import { ProjectUpdates } from "@/components/parity/planning/project-updates";
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/updates",
)({ component: UpdatesRoute });
function UpdatesRoute() {
  const { workspaceId, projectId } = Route.useParams();
  return (
    <ProjectUpdates
      key={projectId}
      workspaceId={workspaceId}
      projectId={projectId}
    />
  );
}
