import { createId } from "@paralleldrive/cuid2";
import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  invitationTable,
  sessionTable,
  teamMemberTable,
  teamTable,
} from "../../database/schema";
import { teamExtTable } from "../../database/schema-parity";
import type { Actor, Transaction } from "../planning/access";
import { findTeam, lockTeamWorkspace, requireTeamMemberTarget } from "./access";
import { publishTeamEvent } from "./events";
import { canChangeTeamMembership } from "./privacy";
import { teamMembershipKey } from "./keys";
import { provisionWorkspaceTeamsInTransaction } from "./provision";
import type { TeamInput, TeamPatch } from "./schema";

async function uniqueKeyWrite<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    const cause =
      (error as { cause?: { code?: string; constraint?: string } }).cause ??
      (error as { code?: string; constraint?: string });
    if (
      cause.code === "23505" &&
      cause.constraint === "team_ext_workspace_key_idx"
    )
      throw new HTTPException(409, {
        message: "Team key is already in use in this workspace",
      });
    throw error;
  }
}

export async function refreshTeamMemberCount(tx: Transaction, teamId: string) {
  await tx
    .update(teamTable)
    .set({
      memberCount: sql`(select count(distinct ${teamMemberTable.userId}) from ${teamMemberTable} where ${teamMemberTable.teamId} = ${teamId})`,
    })
    .where(eq(teamTable.id, teamId));
}

export async function createTeam(who: Actor, input: TeamInput) {
  const id = createId();
  await uniqueKeyWrite(() =>
    db.transaction(async (tx) => {
      await lockTeamWorkspace(tx, who.workspaceId);
      await provisionWorkspaceTeamsInTransaction(tx, who.workspaceId);
      const teams = await tx
        .select({ id: teamTable.id })
        .from(teamTable)
        .where(eq(teamTable.workspaceId, who.workspaceId));
      if (teams.length >= 10)
        throw new HTTPException(409, {
          message:
            "A workspace supports at most ten teams, including archived teams",
        });
      if (input.leadId)
        await requireTeamMemberTarget(tx, who.workspaceId, input.leadId);
      await tx.insert(teamTable).values({
        id,
        name: input.name,
        workspaceId: who.workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const { name: _name, ...extension } = input;
      await tx.insert(teamExtTable).values({
        teamId: id,
        workspaceId: who.workspaceId,
        position: teams.length,
        ...extension,
      });
    }),
  );
  await publishTeamEvent(who.workspaceId, "TEAM_CREATED");
  return id;
}

export async function updateTeam(who: Actor, teamId: string, input: TeamPatch) {
  await uniqueKeyWrite(() =>
    db.transaction(async (tx) => {
      await lockTeamWorkspace(tx, who.workspaceId);
      const current = await findTeam(who, teamId, tx, true);
      if (input.leadId)
        await requireTeamMemberTarget(tx, who.workspaceId, input.leadId);
      const { name, archived, ...extension } = input;
      if (name !== undefined)
        await tx
          .update(teamTable)
          .set({ name, updatedAt: new Date() })
          .where(eq(teamTable.id, teamId));
      const patch = {
        ...extension,
        ...(archived === undefined
          ? {}
          : {
              archivedAt: archived
                ? (current.extension.archivedAt ?? new Date())
                : null,
            }),
      };
      if (Object.values(patch).some((value) => value !== undefined))
        await tx
          .update(teamExtTable)
          .set(patch)
          .where(eq(teamExtTable.teamId, teamId));
    }),
  );
  await publishTeamEvent(who.workspaceId, "TEAM_UPDATED");
}

export async function deleteTeam(who: Actor, teamId: string) {
  await db.transaction(async (tx) => {
    await lockTeamWorkspace(tx, who.workspaceId);
    await findTeam(who, teamId, tx, true);
    await tx
      .update(sessionTable)
      .set({ activeTeamId: null })
      .where(eq(sessionTable.activeTeamId, teamId));
    const invitations = await tx
      .select({ id: invitationTable.id, teamId: invitationTable.teamId })
      .from(invitationTable)
      .where(eq(invitationTable.workspaceId, who.workspaceId))
      .for("update");
    for (const invitation of invitations) {
      if (!invitation.teamId?.split(",").includes(teamId)) continue;
      const remaining = invitation.teamId
        .split(",")
        .filter((id) => id !== teamId)
        .join(",");
      await tx
        .update(invitationTable)
        .set({ teamId: remaining || null })
        .where(eq(invitationTable.id, invitation.id));
    }
    // The parity FK clears assignments; identities never own project/task rows.
    await tx.delete(teamTable).where(eq(teamTable.id, teamId));
  });
  await publishTeamEvent(who.workspaceId, "TEAM_DELETED");
}

export async function changeTeamMember(
  who: Actor,
  teamId: string,
  userId: string,
  add: boolean,
  canManage: boolean,
) {
  await db.transaction(async (tx) => {
    await lockTeamWorkspace(tx, who.workspaceId);
    const team = await findTeam(who, teamId, tx, true);
    if (!canChangeTeamMembership(who.userId, team.extension.leadId, canManage))
      throw new HTTPException(403, {
        message: "Only a team manager or lead can change membership",
      });
    if (add) {
      if (team.extension.archivedAt)
        throw new HTTPException(409, {
          message: "Restore the team before adding members",
        });
      await requireTeamMemberTarget(tx, who.workspaceId, userId);
      const [existing] = await tx
        .select({ id: teamMemberTable.id })
        .from(teamMemberTable)
        .where(
          and(
            eq(teamMemberTable.teamId, teamId),
            eq(teamMemberTable.userId, userId),
          ),
        );
      if (!existing)
        await tx.insert(teamMemberTable).values({
          id: createId(),
          teamId,
          userId,
          membershipKey: teamMembershipKey(teamId, userId),
          createdAt: new Date(),
        });
    } else {
      await tx
        .delete(teamMemberTable)
        .where(
          and(
            eq(teamMemberTable.teamId, teamId),
            eq(teamMemberTable.userId, userId),
          ),
        );
    }
    await refreshTeamMemberCount(tx, teamId);
  });
  await publishTeamEvent(who.workspaceId, "TEAM_MEMBERSHIP_UPDATED");
}
