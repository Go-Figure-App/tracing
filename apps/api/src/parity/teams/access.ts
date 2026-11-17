import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  teamTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { teamExtTable } from "../../database/schema-parity";
import type { DbOrTx } from "../../project-access/db-or-tx";
import type { Actor, Transaction } from "../planning/access";

export async function lockTeamWorkspace(tx: Transaction, workspaceId: string) {
  const [workspace] = await tx
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .for("update");
  if (!workspace)
    throw new HTTPException(404, { message: "Workspace not found" });
}

export async function findTeam(
  who: Actor,
  teamId: string,
  database: DbOrTx = db,
  lock = false,
) {
  const query = database
    .select({ identity: teamTable, extension: teamExtTable })
    .from(teamTable)
    .innerJoin(
      teamExtTable,
      and(
        eq(teamExtTable.teamId, teamTable.id),
        eq(teamExtTable.workspaceId, teamTable.workspaceId),
      ),
    )
    .where(
      and(eq(teamTable.id, teamId), eq(teamTable.workspaceId, who.workspaceId)),
    );
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new HTTPException(404, { message: "Team not found" });
  return row;
}

export async function requireTeamMemberTarget(
  tx: Transaction,
  workspaceId: string,
  userId: string,
) {
  const [member] = await tx
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .for("key share");
  if (!member)
    throw new HTTPException(400, {
      message: "Team members and leads must belong to the workspace",
    });
}

export async function validateProjectTeam(
  tx: Transaction,
  who: Actor,
  teamId: string | null,
) {
  if (teamId === null) return;
  const team = await findTeam(who, teamId, tx, true);
  if (team.extension.archivedAt)
    throw new HTTPException(409, {
      message: "Restore the team before assigning projects",
    });
}
