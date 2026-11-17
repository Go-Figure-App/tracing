import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import getWorkspaceUsers from "@/fetchers/workspace-user/get-workspace-users";
import { Button } from "@/components/ui/button";
import { createTeam, updateTeam, type Team } from "@/fetchers/parity/teams";
import { refreshPlanning } from "../planning/queries";
export function TeamEditor({
  workspaceId,
  team,
  onClose,
}: {
  workspaceId: string;
  team?: Team;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const users = useQuery({
    queryKey: ["parity", "team-workspace-members", workspaceId],
    queryFn: () => getWorkspaceUsers({ workspaceId, limit: 1000 }),
  });
  const members =
    users.data && "members" in users.data ? users.data.members : [];
  const mutation = useMutation({
    mutationKey: ["parity"],
    mutationFn: (form: FormData) => {
      const text = (key: string) => String(form.get(key) ?? "");
      const body = {
        name: text("name"),
        key: text("key"),
        description: text("description"),
        icon: text("icon") || null,
        color: text("color") || null,
        leadId: users.isPending
          ? (team?.leadId ?? null)
          : text("leadId") || null,
      };
      return team
        ? updateTeam(workspaceId, team.id, body)
        : createTeam(workspaceId, body);
    },
    onSuccess: async () => {
      await refreshPlanning(client);
      onClose();
    },
  });
  return (
    <form
      className="grid max-w-xl gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(new FormData(event.currentTarget));
      }}
    >
      <h2 className="font-medium">
        {team ? t("parity:teams.edit") : t("parity:teams.create")}
      </h2>
      {(["name", "key", "description", "icon", "color"] as const).map(
        (field) => (
          <label className="grid gap-1 text-sm" key={field}>
            {t(`parity:teams.${field}`)}
            <input
              className="h-9 rounded-md border bg-background px-3"
              name={field}
              defaultValue={team?.[field] ?? ""}
              required={field === "name" || field === "key"}
              maxLength={
                field === "key"
                  ? 5
                  : field === "description"
                    ? 10_000
                    : field === "name"
                      ? 200
                      : 128
              }
              pattern={
                field === "key"
                  ? "[A-Z]{2,5}"
                  : field === "color"
                    ? "#[0-9a-fA-F]{6}"
                    : undefined
              }
            />
          </label>
        ),
      )}
      <label className="grid gap-1 text-sm">
        {t("parity:teams.leadId")}
        <select
          name="leadId"
          defaultValue={team?.leadId ?? ""}
          disabled={users.isPending}
          className="h-9 rounded-md border bg-background px-3"
        >
          <option value="">{t("parity:planning.noLead")}</option>
          {team?.leadId &&
            !members.some((member) => member.userId === team.leadId) && (
              <option value={team.leadId}>{t("parity:views.unknown")}</option>
            )}
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user.name}
            </option>
          ))}
        </select>
      </label>
      {users.error && (
        <p role="alert">
          {users.error.message}
          <Button type="button" onClick={() => void users.refetch()}>
            {t("parity:planning.retry")}
          </Button>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t("parity:teams.organizeOnly")}
      </p>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {t("parity:planning.save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          {t("common:actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
