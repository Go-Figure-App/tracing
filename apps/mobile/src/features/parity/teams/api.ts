import { request } from "@/lib/api/client";
import type { Team } from "./types";
export const teamsApi = {
  list: (workspaceId: string) =>
    request<Team[]>(`api/parity/teams/${encodeURIComponent(workspaceId)}`),
  get: (workspaceId: string, teamId: string) =>
    request<Team>(
      `api/parity/teams/${encodeURIComponent(workspaceId)}/${encodeURIComponent(teamId)}`,
    ),
};
