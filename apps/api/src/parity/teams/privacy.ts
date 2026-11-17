export function readableTeamProjectCounts(
  projects: { id: string; teamId: string | null }[],
  readable: ReadonlyMap<string, string>,
  workspaceId: string,
) {
  const counts = new Map<string, number>();
  for (const project of projects)
    if (project.teamId && readable.get(project.id) === workspaceId)
      counts.set(project.teamId, (counts.get(project.teamId) ?? 0) + 1);
  return counts;
}
export function canChangeTeamMembership(
  userId: string,
  leadId: string | null,
  canManage: boolean,
) {
  return canManage || leadId === userId;
}
