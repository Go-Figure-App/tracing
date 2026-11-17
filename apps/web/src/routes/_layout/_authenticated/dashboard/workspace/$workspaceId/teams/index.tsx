import { createFileRoute } from "@tanstack/react-router";
import { TeamsPage } from "@/components/parity/teams/teams-page";
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/teams/",
)({ component: Page });
function Page() {
  const { workspaceId } = Route.useParams();
  return <TeamsPage key={workspaceId} workspaceId={workspaceId} />;
}
