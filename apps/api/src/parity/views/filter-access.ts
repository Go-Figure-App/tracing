import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { projectTable, teamTable } from "../../database/schema";
import {
  initiativeTable,
  projectMilestoneTable,
  savedViewTable,
} from "../../database/schema-parity";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { readableProjects, type Actor } from "../planning/access";
import { enabledFeatures } from "../foundation/features";
import type { ViewFilters } from "./schema";

// Keep the complete filter expression private when a referenced project is
// inaccessible. Dropping clauses would change a shared view's meaning.
export function readableViewFilters(who: Actor) {
  return sql`(${enabledFeatures().includes("teams")} or not exists (select 1 from jsonb_array_elements(${savedViewTable.filters}) as filter(value) where filter.value ->> 'field' = 'team')) and not exists (
    select 1 from jsonb_array_elements(${savedViewTable.filters}) as clause(value)
    cross join lateral jsonb_array_elements_text(
      coalesce(clause.value -> 'values', '[]'::jsonb)
    ) as reference(id)
    where reference.id is not null and (
      (clause.value ->> 'field' = 'team' and (not ${enabledFeatures().includes("teams")} or not exists (
        select 1 from ${teamTable} where ${teamTable.id} = reference.id and ${teamTable.workspaceId} = ${who.workspaceId}
      ))) or
      (clause.value ->> 'field' = 'initiative' and not exists (
        select 1 from ${initiativeTable}
        where ${initiativeTable.id} = reference.id and ${initiativeTable.workspaceId} = ${who.workspaceId}
      )) or
      (clause.value ->> 'field' = 'project' and not exists (
        select 1 from ${projectTable}
        where ${projectTable.id} = reference.id and ${readableProjects(who)}
      )) or
      (clause.value ->> 'field' = 'milestone' and not exists (
        select 1 from ${projectMilestoneTable}
        join ${projectTable} on ${projectTable.id} = ${projectMilestoneTable.projectId}
        where ${projectMilestoneTable.id} = reference.id and ${readableProjects(who)}
      ))
    )
  )`;
}

export async function validateViewFilterAccess(
  database: DbOrTx,
  who: Actor,
  filters: ViewFilters,
) {
  if (
    filters.some((filter) => filter.field === "team") &&
    !enabledFeatures().includes("teams")
  )
    throw new HTTPException(404, { message: "Feature not enabled" });
  const ids = (field: "project" | "milestone" | "initiative" | "team") => [
    ...new Set(
      filters.flatMap((filter) =>
        filter.field === field
          ? filter.values.filter((id): id is string => id !== null)
          : [],
      ),
    ),
  ];
  const teams = ids("team");
  if (teams.length) {
    const rows = await database
      .select({ id: teamTable.id })
      .from(teamTable)
      .where(
        and(
          inArray(teamTable.id, teams),
          eq(teamTable.workspaceId, who.workspaceId),
        ),
      );
    if (rows.length !== teams.length)
      throw new HTTPException(400, {
        message: "View filters reference an unavailable team",
      });
  }
  const initiatives = ids("initiative");
  const projects = ids("project");
  const milestones = ids("milestone");
  const [readableProjectRows, readableMilestoneRows, readableInitiativeRows] =
    await Promise.all([
      projects.length
        ? database
            .select({ id: projectTable.id })
            .from(projectTable)
            .where(
              and(inArray(projectTable.id, projects), readableProjects(who)),
            )
        : [],
      milestones.length
        ? database
            .select({ id: projectMilestoneTable.id })
            .from(projectMilestoneTable)
            .innerJoin(
              projectTable,
              eq(projectTable.id, projectMilestoneTable.projectId),
            )
            .where(
              and(
                inArray(projectMilestoneTable.id, milestones),
                readableProjects(who),
              ),
            )
        : [],
      initiatives.length
        ? database
            .select({ id: initiativeTable.id })
            .from(initiativeTable)
            .where(
              and(
                inArray(initiativeTable.id, initiatives),
                eq(initiativeTable.workspaceId, who.workspaceId),
              ),
            )
        : [],
    ]);
  if (
    readableInitiativeRows.length !== initiatives.length ||
    readableProjectRows.length !== projects.length ||
    readableMilestoneRows.length !== milestones.length
  )
    throw new HTTPException(400, {
      message:
        "View filters reference an unavailable project, milestone or initiative",
    });
}
