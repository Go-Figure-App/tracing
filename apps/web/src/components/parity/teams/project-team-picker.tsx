import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateProjectPlan } from "@/fetchers/parity/projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { refreshPlanning, usePlanningEnabled } from "../planning/queries";
import { useTeams } from "./queries";
export function ProjectTeamPicker({
  workspaceId,
  projectId,
  teamId,
}: {
  workspaceId: string;
  projectId: string;
  teamId?: string | null;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const enabled = usePlanningEnabled("teams");
  const teams = useTeams(workspaceId);
  const { canUpdateProjects } = useWorkspacePermission();
  const mutation = useMutation({
    mutationKey: ["parity"],
    mutationFn: (value: string) =>
      updateProjectPlan(projectId, { teamId: value || null }),
    onSuccess: () => refreshPlanning(client),
  });
  if (!enabled) return null;
  return (
    <div className="min-w-0 text-xs">
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">{t("parity:teams.team")}</span>
        <select
          className="h-8 min-w-32 max-w-44 rounded-md border bg-background px-2"
          aria-label={t("parity:teams.team")}
          value={teamId ?? ""}
          disabled={
            !canUpdateProjects() ||
            teams.isPending ||
            teams.isError ||
            mutation.isPending
          }
          onChange={(event) => mutation.mutate(event.target.value)}
        >
          <option value="">{t("parity:teams.noTeam")}</option>
          {teams.data
            ?.filter((team) => !team.archivedAt || team.id === teamId)
            .map((team) => (
              <option
                key={team.id}
                value={team.id}
                disabled={Boolean(team.archivedAt)}
              >
                {team.name}
              </option>
            ))}
        </select>
      </label>
      {(mutation.error || teams.error) && (
        <p role="alert">
          {(mutation.error ?? teams.error)?.message}
          <button
            disabled={mutation.isPending}
            onClick={() => {
              if (mutation.isError && mutation.variables !== undefined)
                mutation.mutate(mutation.variables);
              else void teams.refetch();
            }}
          >
            {t("parity:planning.retry")}
          </button>
        </p>
      )}
    </div>
  );
}
