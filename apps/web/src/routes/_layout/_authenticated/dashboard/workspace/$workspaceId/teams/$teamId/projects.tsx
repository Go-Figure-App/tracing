import { createFileRoute } from "@tanstack/react-router";
import { TeamsPage } from "@/components/parity/teams/teams-page";
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/teams/$teamId/projects",
)({ component: Page });
function Page() {
  const { workspaceId, teamId } = Route.useParams();
  return (
    <TeamsPage
      key={teamId}
      workspaceId={workspaceId}
      teamId={teamId}
      section="projects"
    />
  );
}
