import { useQuery } from "@tanstack/react-query";
import { usePlanningEnabled } from "../planning/queries";
import { teamsApi } from "./api";
export function useTeams(workspaceId: string) {
  const enabled = usePlanningEnabled("teams");
  return useQuery({
    queryKey: ["parity", "teams", workspaceId],
    queryFn: () => teamsApi.list(workspaceId),
    enabled: enabled && Boolean(workspaceId),
  });
}
