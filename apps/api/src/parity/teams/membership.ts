import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

// Instance administrators must also join a workspace before browsing its teams.
export async function requireTeamWorkspaceMember(c: Context, next: Next) {
  const [member] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, c.get("workspaceId")),
        eq(workspaceUserTable.userId, c.get("userId")),
      ),
    )
    .limit(1);
  if (!member) throw new HTTPException(404, { message: "Workspace not found" });
  return next();
}
