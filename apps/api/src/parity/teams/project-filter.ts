import { eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { projectTable, teamTable } from "../../database/schema";
import { projectExtTable } from "../../database/schema-parity";
import { enabledFeatures } from "../foundation/features";
import type { Actor } from "../planning/access";
import { findTeam } from "./access";

// Derive ownership from the current project workspace, including during the
// interval between an upstream project move and its reconciliation subscriber.
export const projectTeamId = sql<string | null>`(
  select ${teamTable.id} from ${teamTable}
  join ${projectExtTable} on ${projectExtTable.teamId} = ${teamTable.id}
  where ${projectExtTable.projectId} = ${projectTable.id}
    and ${teamTable.workspaceId} = ${projectTable.workspaceId}
)`;

export function projectTeamCondition(team?: string) {
  return team === undefined
    ? undefined
    : team === "none"
      ? isNull(projectTeamId)
      : eq(projectTeamId, team);
}

export async function validateTeamFilter(who: Actor, team?: string) {
  if (team === undefined) return;
  if (!enabledFeatures().includes("teams"))
    throw new HTTPException(404, { message: "Feature not enabled" });
  if (team !== "none") await findTeam(who, team);
}
