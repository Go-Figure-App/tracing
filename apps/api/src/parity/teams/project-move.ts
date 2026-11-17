import { and, eq, isNotNull } from "drizzle-orm";
import { projectExtTable } from "../../database/schema-parity";
import type { Transaction } from "../planning/access";

export async function clearMovedProjectTeam(
  tx: Transaction,
  projectId: string,
) {
  const cleared = await tx
    .update(projectExtTable)
    .set({ teamId: null })
    .where(
      and(
        eq(projectExtTable.projectId, projectId),
        isNotNull(projectExtTable.teamId),
      ),
    )
    .returning({ id: projectExtTable.projectId });
  return cleared.length > 0;
}
