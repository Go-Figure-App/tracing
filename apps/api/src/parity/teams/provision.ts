import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { teamTable } from "../../database/schema";
import { teamExtTable } from "../../database/schema-parity";
import type { Transaction } from "../planning/access";
import { lockTeamWorkspace } from "./access";
import { allocateTeamKey } from "./keys";

// Only called behind the feature flag. Serializing on the workspace keeps key
// allocation stable across startup, provisioning and ordinary team creates.
export async function provisionWorkspaceTeamsInTransaction(
  tx: Transaction,
  workspaceId: string,
) {
  const identities = await tx
    .select()
    .from(teamTable)
    .where(eq(teamTable.workspaceId, workspaceId))
    .orderBy(asc(teamTable.createdAt), asc(teamTable.id));
  const extensions = await tx
    .select()
    .from(teamExtTable)
    .where(eq(teamExtTable.workspaceId, workspaceId));
  const present = new Set(extensions.map((row) => row.teamId));
  const taken = new Set(extensions.map((row) => row.key));
  let position = Math.max(-1, ...extensions.map((row) => row.position)) + 1;
  for (const identity of identities) {
    if (present.has(identity.id)) continue;
    const key = allocateTeamKey(identity.name, taken);
    taken.add(key);
    await tx
      .insert(teamExtTable)
      .values({ teamId: identity.id, workspaceId, key, position: position++ });
  }
}

export async function provisionWorkspaceTeams(workspaceId: string) {
  await db.transaction(async (tx) => {
    await lockTeamWorkspace(tx, workspaceId);
    await provisionWorkspaceTeamsInTransaction(tx, workspaceId);
  });
}
