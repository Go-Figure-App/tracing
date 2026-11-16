import { z } from "zod";

export const id = z.string().trim().min(1).max(128);
export const date = z.iso.date().nullable().optional();
export const position = z.number().int().min(0).max(1_000_000).optional();
export const page = {
  page: z.number().int().min(1).max(100_000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
};
export function queryString(options: Record<string, unknown>) {
  return new URLSearchParams(
    Object.entries(options)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}
export function hasChanges(input: Record<string, unknown>) {
  return Object.entries(input).some(
    ([key, value]) =>
      key !== "id" && key !== "workspaceId" && value !== undefined,
  );
}
