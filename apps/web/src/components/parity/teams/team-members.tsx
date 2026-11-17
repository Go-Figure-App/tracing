import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  changeTeamMember,
  getTeamMembers,
  type Team,
} from "@/fetchers/parity/teams";
import getWorkspaceUsers from "@/fetchers/workspace-user/get-workspace-users";
import { authClient } from "@/lib/auth-client";
import { refreshPlanning } from "../planning/queries";
import { useTeamPermissions } from "./permissions";
export function TeamMembers({ team }: { team: Team }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [userId, setUserId] = useState("");
  const session = authClient.useSession();
  const permissions = useTeamPermissions(team.workspaceId);
  const canManage =
    permissions.data?.update || team.leadId === session.data?.user.id;
  const query = useQuery({
    queryKey: ["parity", "team-members", team.id],
    queryFn: () => getTeamMembers(team.workspaceId, team.id),
  });
  const users = useQuery({
    queryKey: ["parity", "team-workspace-members", team.workspaceId],
    queryFn: () =>
      getWorkspaceUsers({ workspaceId: team.workspaceId, limit: 1000 }),
    enabled: canManage,
  });
  const mutation = useMutation({
    mutationKey: ["parity"],
    mutationFn: ({ id, add }: { id: string; add: boolean }) =>
      changeTeamMember(team.workspaceId, team.id, id, add),
    onSuccess: async () => {
      setUserId("");
      await refreshPlanning(client);
    },
  });
  const members =
    users.data && "members" in users.data ? users.data.members : [];
  return (
    <section className="space-y-3">
      <h2 className="font-medium">{t("parity:teams.members")}</h2>
      {query.isPending && <p role="status">{t("parity:planning.loading")}</p>}
      {query.error && (
        <p role="alert">
          {query.error.message}
          <Button onClick={() => void query.refetch()}>
            {t("parity:planning.retry")}
          </Button>
        </p>
      )}
      {!query.isPending && !query.error && !query.data?.length && (
        <p>{t("parity:teams.noMembers")}</p>
      )}
      {query.data?.map((member) => (
        <div className="flex items-center gap-3" key={member.id}>
          <span>{member.name}</span>
          {canManage && (
            <Button
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ id: member.id, add: false })}
            >
              {t("parity:teams.removeMember")}
            </Button>
          )}
        </div>
      ))}
      {canManage && !team.archivedAt && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({ id: userId, add: true });
          }}
        >
          <select
            aria-label={t("parity:teams.members")}
            className="h-9 max-w-full rounded border bg-background px-2"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={users.isPending || users.isError}
          >
            <option value="">{t("parity:teams.selectMember")}</option>
            {members
              .filter(
                (member) =>
                  !query.data?.some((item) => item.id === member.userId),
              )
              .map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
          </select>
          <Button type="submit" disabled={!userId || mutation.isPending}>
            {t("parity:teams.addMember")}
          </Button>
        </form>
      )}
      {users.error && (
        <p role="alert">
          {users.error.message}
          <Button onClick={() => void users.refetch()}>
            {t("parity:planning.retry")}
          </Button>
        </p>
      )}
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </section>
  );
}
