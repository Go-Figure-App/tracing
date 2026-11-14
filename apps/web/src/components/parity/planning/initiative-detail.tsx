import { FavoriteButton } from "../views/favorite-button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Target, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { MarkdownRenderer } from "@/components/public-project/markdown-renderer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteInitiative,
  getInitiative,
  unlinkInitiativeProject,
  updateInitiative,
} from "@/fetchers/parity/initiatives";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { HealthBadge } from "./health-badge";
import { InitiativeEditor } from "./initiative-editor";
import { usePlanningLabels } from "./labels";
import { LinkProjectDialog } from "./link-project-dialog";
import { ProgressMeter } from "./progress-meter";
import { refreshPlanning, usePlanningEnabled } from "./queries";
import { UpdateFeed } from "./update-feed";
import { ProjectsTable } from "./projects-table";
import { PlanningStatusIcon } from "./status-icon";

export function InitiativeDetail({
  workspaceId,
  initiativeId,
}: {
  workspaceId: string;
  initiativeId: string;
}) {
  const { t } = useTranslation();
  const labels = usePlanningLabels();
  const client = useQueryClient();
  const navigate = useNavigate();
  const enabled = usePlanningEnabled("initiatives");
  const { canUpdateProjects, canManageSettings } = useWorkspacePermission();
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({
    queryKey: ["parity", "initiative", initiativeId, workspaceId],
    queryFn: () => getInitiative(initiativeId),
    enabled,
  });
  const initiative =
    !query.isError && query.data?.workspaceId === workspaceId
      ? query.data
      : undefined;
  const archive = useMutation({
    mutationKey: ["parity"],
    mutationFn: (archived: boolean) =>
      updateInitiative(initiativeId, { archived }),
    onSuccess: () => refreshPlanning(client),
  });
  const unlink = useMutation({
    mutationKey: ["parity"],
    mutationFn: (projectId: string) =>
      unlinkInitiativeProject(initiativeId, projectId),
    onSuccess: () => refreshPlanning(client),
  });
  const remove = useMutation({
    mutationKey: ["parity"],
    mutationFn: () => deleteInitiative(initiativeId),
    onSuccess: async () => {
      await refreshPlanning(client);
      await navigate({
        to: "/dashboard/workspace/$workspaceId/initiatives",
        params: { workspaceId },
      });
    },
  });
  return (
    <WorkspaceLayout
      title={initiative?.name ?? t("parity:planning.initiative")}
    >
      <PageTitle title={initiative?.name ?? t("parity:planning.initiative")} />
      <div className="flex h-full min-h-0 flex-col">
        <nav
          aria-label={t("parity:planning.initiatives")}
          className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-2"
        >
          <Link
            to="/dashboard/workspace/$workspaceId/initiatives"
            params={{ workspaceId }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            {t("parity:planning.initiatives")}
          </Link>
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs">
            {t("parity:planning.overview")}
          </span>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-8 px-5 py-8 sm:px-10">
            {!enabled ? (
              <p>{t("parity:planning.unavailable")}</p>
            ) : query.isPending ? (
              <p role="status">{t("parity:planning.loading")}</p>
            ) : query.error ? (
              <div role="alert">
                {query.error.message}
                <Button variant="ghost" onClick={() => query.refetch()}>
                  {t("parity:planning.retry")}
                </Button>
              </div>
            ) : !initiative ? (
              <p role="alert">{t("parity:planning.noAccess")}</p>
            ) : (
              <>
                <header className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold tracking-tight">
                      <Target
                        aria-hidden="true"
                        className="mb-4 size-8 rounded-lg bg-muted p-1.5 text-muted-foreground"
                      />
                      {initiative.name}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                      <FavoriteButton
                        workspaceId={workspaceId}
                        kind="initiative"
                        targetId={initiativeId}
                      />
                      {canUpdateProjects() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(true)}
                        >
                          {t("parity:planning.editProperties")}
                        </Button>
                      )}
                      {canManageSettings() && (
                        <>
                          {canUpdateProjects() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={archive.isPending}
                              onClick={() =>
                                archive.mutate(!initiative.archivedAt)
                              }
                            >
                              {initiative.archivedAt
                                ? t("parity:planning.restore")
                                : t("parity:planning.archive")}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(true)}
                          >
                            {t("parity:planning.delete")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
                      <PlanningStatusIcon status={initiative.status} />
                      {initiative.archivedAt
                        ? t("parity:planning.archived")
                        : labels.status[initiative.status]}
                    </span>
                    <HealthBadge health={initiative.health} />
                  </div>
                  {initiative.description ? (
                    <MarkdownRenderer content={initiative.description} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("parity:planning.noDescription")}
                    </p>
                  )}
                </header>
                {(archive.error || unlink.error) && (
                  <p role="alert" className="text-sm text-destructive">
                    {archive.error?.message ?? unlink.error?.message}
                  </p>
                )}
                <div className="flex flex-col gap-8">
                  <aside className="flex flex-wrap items-start gap-8 border-y border-border/60 py-4">
                    <ProgressMeter progress={initiative.progress} />
                    <dl className="grid grid-cols-[auto_auto] gap-x-5 gap-y-3 text-xs">
                      <dt className="text-muted-foreground">
                        {t("parity:planning.owner")}
                      </dt>
                      <dd>
                        {initiative.ownerName ?? t("parity:planning.noOwner")}
                      </dd>
                      <dt className="text-muted-foreground">
                        {t("parity:planning.targetDate")}
                      </dt>
                      <dd>
                        {initiative.targetDate
                          ? formatDateMedium(
                              new Date(`${initiative.targetDate}T12:00:00`),
                            )
                          : t("parity:planning.noDate")}
                      </dd>
                    </dl>
                  </aside>
                  <div className="min-w-0 space-y-9">
                    <section className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold">
                          {t("parity:planning.linkedProjects")}
                        </h2>
                        {canUpdateProjects() && !initiative.archivedAt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setLinking(true)}
                          >
                            <Plus className="size-3.5" />
                            {t("parity:planning.linkProject")}
                          </Button>
                        )}
                      </div>
                      {initiative.projects.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("parity:planning.noProjects")}
                        </p>
                      )}
                      <ProjectsTable
                        projects={initiative.projects}
                        groupBy="status"
                        columns={["health", "lead", "progress", "status"]}
                        actions={
                          canUpdateProjects() && !initiative.archivedAt
                            ? (project) => (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t(
                                    "parity:planning.unlinkProject",
                                  )}
                                  disabled={unlink.isPending}
                                  onClick={() => unlink.mutate(project.id)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              )
                            : undefined
                        }
                      />
                    </section>
                    <UpdateFeed
                      key={initiativeId}
                      parentType="initiative"
                      parentId={initiativeId}
                      canUpdate={canUpdateProjects() && !initiative.archivedAt}
                      initialHealth={initiative.health}
                    />
                  </div>
                </div>
                {editing && (
                  <InitiativeEditor
                    workspaceId={workspaceId}
                    initiative={initiative}
                    onClose={() => setEditing(false)}
                  />
                )}
                {linking && (
                  <LinkProjectDialog
                    workspaceId={workspaceId}
                    initiativeId={initiativeId}
                    linkedIds={initiative.projects.map((project) => project.id)}
                    onClose={() => setLinking(false)}
                  />
                )}
                {deleting && (
                  <Dialog
                    open
                    onOpenChange={(open) => {
                      if (!open) setDeleting(false);
                    }}
                  >
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {t("parity:planning.deleteInitiative")}
                        </DialogTitle>
                      </DialogHeader>
                      <p className="text-sm">{initiative.name}</p>
                      {remove.error && (
                        <p role="alert">{remove.error.message}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setDeleting(false)}
                        >
                          {t("parity:planning.cancel")}
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate()}
                        >
                          {t("parity:planning.confirmDelete")}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
