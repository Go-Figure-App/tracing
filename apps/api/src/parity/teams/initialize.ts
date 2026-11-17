import { and, eq, inArray, ne } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  teamMemberTable,
  teamTable,
  workspaceTable,
} from "../../database/schema";
import { projectExtTable, teamExtTable } from "../../database/schema-parity";
import { subscribeToEvent } from "../../events";
import { enabledFeatures } from "../foundation/features";
import { lockTeamWorkspace } from "./access";
import { publishTeamEvent } from "./events";
import { provisionWorkspaceTeams } from "./provision";
import { refreshTeamMemberCount } from "./write";

const enabled = () => enabledFeatures().includes("teams");
export async function provisionNewWorkspaceTeams(workspaceId: string) {
  if (enabled()) await provisionWorkspaceTeams(workspaceId);
}

export async function removeWorkspaceTeamMember(
  workspaceId: string,
  userId: string,
) {
  if (!enabled()) return;
  await db.transaction(async (tx) => {
    await lockTeamWorkspace(tx, workspaceId);
    const teams = await tx
      .select({ id: teamTable.id })
      .from(teamTable)
      .where(eq(teamTable.workspaceId, workspaceId));
    if (teams.length) {
      await tx.delete(teamMemberTable).where(
        and(
          eq(teamMemberTable.userId, userId),
          inArray(
            teamMemberTable.teamId,
            teams.map((row) => row.id),
          ),
        ),
      );
      for (const team of teams) await refreshTeamMemberCount(tx, team.id);
    }
    await tx
      .update(teamExtTable)
      .set({ leadId: null })
      .where(
        and(
          eq(teamExtTable.workspaceId, workspaceId),
          eq(teamExtTable.leadId, userId),
        ),
      );
  });
  await publishTeamEvent(workspaceId, "TEAM_MEMBERSHIP_UPDATED");
}

let initialized = false;
export async function initializeTeams() {
  if (!enabled() || initialized) return;
  const workspaces = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable);
  for (const workspace of workspaces)
    await provisionWorkspaceTeams(workspace.id);
  await subscribeToEvent<{ projectId: string }>(
    "project.updated",
    async ({ projectId }) => {
      if (!enabled()) return;
      const affected = await db.transaction(async (tx) => {
        const [project] = await tx
          .select()
          .from(projectTable)
          .where(eq(projectTable.id, projectId))
          .for("update");
        if (!project) return;
        const [stale] = await tx
          .select({
            id: projectExtTable.projectId,
            workspaceId: teamTable.workspaceId,
          })
          .from(projectExtTable)
          .innerJoin(teamTable, eq(teamTable.id, projectExtTable.teamId))
          .where(
            and(
              eq(projectExtTable.projectId, projectId),
              ne(teamTable.workspaceId, project.workspaceId),
            ),
          );
        if (!stale) return;
        await tx
          .update(projectExtTable)
          .set({ teamId: null })
          .where(eq(projectExtTable.projectId, projectId));
        return [project.workspaceId, stale.workspaceId];
      });
      for (const workspaceId of new Set(affected ?? []))
        await publishTeamEvent(workspaceId, "PROJECT_TEAM_UPDATED");
    },
  );
  initialized = true;
}
