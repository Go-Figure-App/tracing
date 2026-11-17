import { APIError, type getSessionFromCtx } from "better-auth/api";
import { eq } from "drizzle-orm";
import db from "../../database";
import { invitationTable } from "../../database/schema";
import { enabledFeatures } from "../foundation/features";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];
const rawWrites = new Set([
  "/organization/create-team",
  "/organization/update-team",
  "/organization/remove-team",
  "/organization/add-team-member",
  "/organization/remove-team-member",
]);
function deny() {
  throw new APIError("FORBIDDEN", {
    code: "TEAMS_PARITY_ROUTE_REQUIRED",
    message:
      "Manage teams through the Tracing Teams API. Team-bearing invitations must be reissued without a team, then assigned through Teams.",
  });
}

export async function assertNativeTeamRouteAllowed(ctx: AuthContext) {
  if (!enabledFeatures().includes("teams")) return;
  if (rawWrites.has(ctx.path ?? "")) deny();
  if (
    (ctx.path === "/organization/invite-member" ||
      ctx.path === "/organization/add-member") &&
    ctx.body?.teamId
  )
    deny();
  if (
    ctx.path === "/organization/accept-invitation" &&
    typeof ctx.body?.invitationId === "string"
  ) {
    const [invitation] = await db
      .select({ teamId: invitationTable.teamId })
      .from(invitationTable)
      .where(eq(invitationTable.id, ctx.body.invitationId));
    if (invitation?.teamId) deny();
  }
}
