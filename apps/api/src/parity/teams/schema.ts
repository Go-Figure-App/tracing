import { nullableResponseTimestamp, z } from "../../openapi";

export const teamKey = z.string().regex(/^[A-Z]{2,5}$/);
const id = z.string().min(1).max(128);
export const teamBody = z.strictObject({
  name: z.string().trim().min(1).max(200),
  key: teamKey,
  description: z.string().max(10_000).default(""),
  icon: z.string().max(100).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  leadId: id.nullable().optional(),
});
export const teamPatch = teamBody.partial().extend({
  description: z.string().max(10_000).optional(),
  archived: z.boolean().optional(),
});
export const teamSummary = z.object({
  id,
  workspaceId: id,
  name: z.string(),
  key: teamKey,
  description: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  leadId: id.nullable(),
  archivedAt: nullableResponseTimestamp,
  position: z.number(),
});
export const teamSchema = teamSummary.extend({
  memberCount: z.number(),
  projectCount: z.number(),
});
export const teamMemberSchema = z.object({
  id,
  name: z.string(),
  image: z.string().nullable(),
});
export type TeamInput = z.infer<typeof teamBody>;
export type TeamPatch = z.infer<typeof teamPatch>;
