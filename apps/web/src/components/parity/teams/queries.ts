import { useQuery } from "@tanstack/react-query";
import { getTeams } from "@/fetchers/parity/teams";
import { usePlanningEnabled } from "../planning/queries";
export function useTeams(workspaceId: string) {
  const enabled = usePlanningEnabled("teams");
  return useQuery({
    queryKey: ["parity", "teams", workspaceId],
    queryFn: () => getTeams(workspaceId),
    enabled: enabled && Boolean(workspaceId),
  });
}
