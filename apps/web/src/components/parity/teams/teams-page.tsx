import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { Button } from "@/components/ui/button";
import { deleteTeam, updateTeam, type Team } from "@/fetchers/parity/teams";
import { refreshPlanning, usePlanningEnabled } from "../planning/queries";
import { IssuesBrowser } from "../views/issues-browser";
import { useTeams } from "./queries";
import { useTeamPermissions } from "./permissions";
import { TeamEditor } from "./team-editor";
import { TeamMembers } from "./team-members";
import { TeamProjects } from "./team-projects";
export function TeamsPage({
  workspaceId,
  teamId,
  section = "issues",
}: {
  workspaceId: string;
  teamId?: string;
  section?: "issues" | "projects" | "members" | "settings";
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const enabled = usePlanningEnabled("teams");
  const query = useTeams(workspaceId);
  const permissions = useTeamPermissions(workspaceId);
  const [editing, setEditing] = useState<Team | "new">();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const team = query.data?.find((item) => item.id === teamId);
  const mutation = useMutation({
    mutationKey: ["parity"],
    mutationFn: async ({ team, remove }: { team: Team; remove: boolean }) => {
      if (remove) await deleteTeam(workspaceId, team.id);
      else
        await updateTeam(workspaceId, team.id, { archived: !team.archivedAt });
    },
    onSuccess: async (_data, { remove }) => {
      setConfirmDelete(false);
      await refreshPlanning(client);
      if (remove)
        await navigate({
          to: "/dashboard/workspace/$workspaceId/teams",
          params: { workspaceId },
        });
    },
  });
  const base = `/dashboard/workspace/${workspaceId}/teams`;
  return (
    <WorkspaceLayout title={team?.name ?? t("parity:teams.title")}>
      <div className="h-full space-y-5 overflow-auto p-4 sm:p-6">
        {!enabled ? (
          <p>{t("parity:planning.unavailable")}</p>
        ) : query.isPending ? (
          <p role="status">{t("parity:planning.loading")}</p>
        ) : query.error ? (
          <p role="alert">
            {query.error.message}
            <Button onClick={() => void query.refetch()}>
              {t("parity:planning.retry")}
            </Button>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">
                {team?.name ?? t("parity:teams.title")}
              </h1>
              {!teamId && permissions.data?.create && (
                <Button onClick={() => setEditing("new")}>
                  {t("parity:teams.create")}
                </Button>
              )}
            </div>
            {editing && (
              <TeamEditor
                key={editing === "new" ? "new" : editing.id}
                workspaceId={workspaceId}
                team={editing === "new" ? undefined : editing}
                onClose={() => setEditing(undefined)}
              />
            )}
            {teamId ? (
              team ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {team.key} · {team.description}
                    {team.archivedAt && ` · ${t("parity:teams.archived")}`}
                  </p>
                  <nav className="flex flex-wrap gap-4 border-b pb-3">
                    {(
                      ["issues", "projects", "members", "settings"] as const
                    ).map((value) => (
                      <Link
                        key={value}
                        to={`${base}/${team.id}/${value}`}
                        aria-current={section === value ? "page" : undefined}
                        className={
                          section === value
                            ? "font-semibold"
                            : "text-muted-foreground"
                        }
                      >
                        {t(`parity:teams.${value}`)}
                      </Link>
                    ))}
                  </nav>
                  {section === "issues" ? (
                    <IssuesBrowser
                      key={team.id}
                      workspaceId={workspaceId}
                      teamId={team.id}
                    />
                  ) : section === "projects" ? (
                    <TeamProjects workspaceId={workspaceId} teamId={team.id} />
                  ) : section === "members" ? (
                    <TeamMembers team={team} />
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {t("parity:teams.organizeOnly")}
                      </p>
                      {permissions.data?.update && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setEditing(team)}
                          >
                            {t("parity:teams.edit")}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({ team, remove: false })
                            }
                          >
                            {team.archivedAt
                              ? t("parity:teams.restore")
                              : t("parity:teams.archive")}
                          </Button>
                        </>
                      )}
                      {permissions.data?.remove && (
                        <div>
                          {confirmDelete ? (
                            <div role="alert" className="space-y-3">
                              <p>{t("parity:teams.deleteWarning")}</p>
                              <Button
                                variant="destructive"
                                disabled={mutation.isPending}
                                onClick={() =>
                                  mutation.mutate({ team, remove: true })
                                }
                              >
                                {t("parity:teams.delete")}
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => setConfirmDelete(false)}
                              >
                                {t("common:actions.cancel")}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="destructive"
                              onClick={() => setConfirmDelete(true)}
                            >
                              {t("parity:teams.delete")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p>
                  {t("parity:teams.notFound")}{" "}
                  <Link to={base}>{t("parity:teams.title")}</Link>
                </p>
              )
            ) : (
              <div className="divide-y">
                {!query.data?.length && <p>{t("parity:teams.empty")}</p>}
                {query.data?.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <Link
                      to={`${base}/${item.id}/issues`}
                      className="font-medium"
                    >
                      {item.key} · {item.name}
                      {item.archivedAt && ` · ${t("parity:teams.archived")}`}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {t("parity:teams.counts", {
                        members: item.memberCount,
                        projects: item.projectCount,
                      })}
                    </span>
                    <Link to={`${base}/${item.id}/settings`}>
                      {t("parity:teams.settings")}
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {mutation.error && <p role="alert">{mutation.error.message}</p>}
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
}
