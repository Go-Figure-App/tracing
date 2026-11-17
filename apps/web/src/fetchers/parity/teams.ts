import { client } from "@tracing/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";
const teams = client.parity.teams[":workspaceId"];
export type TeamInput = InferRequestType<typeof teams.$post>["json"];
export type TeamPatch = InferRequestType<
  (typeof teams)[":teamId"]["$put"]
>["json"];
export async function getTeams(workspaceId: string) {
  const response = await teams.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
export type Team = Awaited<ReturnType<typeof getTeams>>[number];
export async function createTeam(workspaceId: string, json: TeamInput) {
  const response = await teams.$post({ param: { workspaceId }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
export async function updateTeam(
  workspaceId: string,
  teamId: string,
  json: TeamPatch,
) {
  const response = await teams[":teamId"].$put({
    param: { workspaceId, teamId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
export async function deleteTeam(workspaceId: string, teamId: string) {
  const response = await teams[":teamId"].$delete({
    param: { workspaceId, teamId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
export async function getTeamMembers(workspaceId: string, teamId: string) {
  const response = await teams[":teamId"].members.$get({
    param: { workspaceId, teamId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
export async function changeTeamMember(
  workspaceId: string,
  teamId: string,
  userId: string,
  add: boolean,
) {
  const endpoint = teams[":teamId"].members[":userId"];
  const response = await (add
    ? endpoint.$post({ param: { workspaceId, teamId, userId } })
    : endpoint.$delete({ param: { workspaceId, teamId, userId } }));
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
