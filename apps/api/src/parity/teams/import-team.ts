import { importId } from "../import/values";
import { and, eq } from "drizzle-orm";
import { teamTable } from "../../database/schema";
import { teamExtTable } from "../../database/schema-parity";
import { enabledFeatures } from "../foundation/features";
import type { ProjectPlanning } from "../import/types";
import type { Transaction } from "../planning/access";
import { lockTeamWorkspace } from "./access";
import { allocateTeamKey } from "./keys";
import { provisionWorkspaceTeamsInTransaction } from "./provision";

export async function importProjectTeam(
  tx: Transaction,
  workspaceId: string,
  data: ProjectPlanning,
  warnings: string[],
) {
  if (!enabledFeatures().includes("teams")) return undefined;
  const ids = [...new Set(data.teamIds)];
  if (ids.length !== 1) {
    if (ids.length > 1)
      warnings.push(
        "This Linear project belongs to multiple teams. It was imported with No team so ownership is not chosen arbitrarily.",
      );
    return null;
  }
  const source = data.workspace.teams.find((team) => team.id === ids[0]);
  if (!source) throw new Error("Linear project team metadata is missing");
  await lockTeamWorkspace(tx, workspaceId);
  await provisionWorkspaceTeamsInTransaction(tx, workspaceId);
  const teams = await tx
    .select({
      id: teamTable.id,
      name: teamTable.name,
      key: teamExtTable.key,
      archivedAt: teamExtTable.archivedAt,
    })
    .from(teamTable)
    .innerJoin(
      teamExtTable,
      and(
        eq(teamExtTable.teamId, teamTable.id),
        eq(teamExtTable.workspaceId, teamTable.workspaceId),
      ),
    )
    .where(eq(teamTable.workspaceId, workspaceId));
  const id = importId(workspaceId, "team", source.id);
  const existing =
    teams.find((team) => team.id === id) ??
    teams.find((team) => team.name === source.name && team.key === source.key);
  if (existing) {
    if (existing.archivedAt) {
      warnings.push(
        "The matching destination team is archived; the project was imported with No team.",
      );
      return null;
    }
    return existing.id;
  }
  if (teams.length >= 10) {
    warnings.push(
      "The destination has ten teams; the project was imported with No team.",
    );
    return null;
  }
  const taken = new Set(teams.map((team) => team.key));
  const key =
    /^[A-Z]{2,5}$/.test(source.key) && !taken.has(source.key)
      ? source.key
      : allocateTeamKey(source.name, taken);
  if (key !== source.key)
    warnings.push(
      "A source team key was unavailable or invalid; a unique destination key was allocated.",
    );

  await tx.insert(teamTable).values({
    id,
    name: source.name,
    workspaceId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await tx.insert(teamExtTable).values({
    teamId: id,
    workspaceId,
    key,
    description: source.description ?? "",
    position: teams.length,
  });
  return id;
}
