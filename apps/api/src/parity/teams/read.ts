import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  teamMemberTable,
  teamTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { projectExtTable, teamExtTable } from "../../database/schema-parity";
import { findAccessibleProjects } from "../../project-access/find-accessible-projects";
import type { Actor } from "../planning/access";
import { readableTeamProjectCounts } from "./privacy";
import { findTeam } from "./access";

export async function listTeams(who: Actor, projectRead: boolean) {
  const rows = await db
    .select({
      id: teamTable.id,
      workspaceId: teamTable.workspaceId,
      name: teamTable.name,
      key: teamExtTable.key,
      description: teamExtTable.description,
      icon: teamExtTable.icon,
      color: teamExtTable.color,
      leadId: teamExtTable.leadId,
      archivedAt: teamExtTable.archivedAt,
      position: teamExtTable.position,
    })
    .from(teamTable)
    .innerJoin(
      teamExtTable,
      and(
        eq(teamExtTable.teamId, teamTable.id),
        eq(teamExtTable.workspaceId, teamTable.workspaceId),
      ),
    )
    .where(eq(teamTable.workspaceId, who.workspaceId))
    .orderBy(asc(teamExtTable.position), asc(teamTable.id));
  const members = await db
    .select({
      teamId: teamMemberTable.teamId,
      count: sql<number>`count(distinct ${teamMemberTable.userId})`.mapWith(
        Number,
      ),
    })
    .from(teamMemberTable)
    .innerJoin(teamTable, eq(teamTable.id, teamMemberTable.teamId))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, teamTable.workspaceId),
        eq(workspaceUserTable.userId, teamMemberTable.userId),
      ),
    )
    .where(eq(teamTable.workspaceId, who.workspaceId))
    .groupBy(teamMemberTable.teamId);
  const projects = projectRead
    ? await db
        .select({ id: projectTable.id, teamId: projectExtTable.teamId })
        .from(projectTable)
        .innerJoin(
          projectExtTable,
          eq(projectExtTable.projectId, projectTable.id),
        )
        .innerJoin(
          teamTable,
          and(
            eq(teamTable.id, projectExtTable.teamId),
            eq(teamTable.workspaceId, projectTable.workspaceId),
          ),
        )
        .where(
          and(
            eq(projectTable.workspaceId, who.workspaceId),
            isNull(projectTable.archivedAt),
          ),
        )
    : [];
  const readable = await findAccessibleProjects(
    who.userId,
    projects.map((row) => row.id),
  );
  const counts = readableTeamProjectCounts(projects, readable, who.workspaceId);
  const memberCounts = new Map(members.map((row) => [row.teamId, row.count]));
  return rows.map((row) => ({
    ...row,
    memberCount: memberCounts.get(row.id) ?? 0,
    projectCount: counts.get(row.id) ?? 0,
  }));
}

export async function getTeam(
  who: Actor,
  teamId: string,
  projectRead: boolean,
) {
  await findTeam(who, teamId);
  const team = (await listTeams(who, projectRead)).find(
    (row) => row.id === teamId,
  );
  if (!team) throw new HTTPException(404, { message: "Team not found" });
  return team;
}

export async function listTeamMembers(who: Actor, teamId: string) {
  await findTeam(who, teamId);
  return db
    .selectDistinct({
      id: userTable.id,
      name: userTable.name,
      image: userTable.image,
    })
    .from(teamMemberTable)
    .innerJoin(userTable, eq(userTable.id, teamMemberTable.userId))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.userId, userTable.id),
        eq(workspaceUserTable.workspaceId, who.workspaceId),
      ),
    )
    .where(eq(teamMemberTable.teamId, teamId))
    .orderBy(asc(userTable.name), asc(userTable.id));
}
