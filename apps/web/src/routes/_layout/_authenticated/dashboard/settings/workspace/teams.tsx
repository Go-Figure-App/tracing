import { createFileRoute } from "@tanstack/react-router";
import { TeamsPage } from "@/components/parity/teams/teams-page";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/teams",
)({ component: Page });
function Page() {
  const { data: workspace } = useActiveWorkspace();
  return workspace ? (
    <TeamsPage key={workspace.id} workspaceId={workspace.id} />
  ) : null;
}
