import { publishEvent } from "../../events";

export function publishTeamEvent(
  workspaceId: string,
  type:
    | "TEAM_CREATED"
    | "TEAM_UPDATED"
    | "TEAM_DELETED"
    | "TEAM_MEMBERSHIP_UPDATED"
    | "PROJECT_TEAM_UPDATED",
) {
  return publishEvent("parity.workspace_updated", { type, workspaceId });
}
