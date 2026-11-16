import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateProjectPlan, type PlanInput } from "@/fetchers/parity/projects";
import getProjectMembers from "@/fetchers/workspace-user/get-project-members";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { getPriorityIcon } from "@/lib/priority";
import { priorities, projectStatuses, usePlanningLabels } from "./labels";
import type { ProjectSummary } from "./project-collection";
import { refreshPlanning } from "./queries";
import { PlanningStatusIcon } from "./status-icon";

export type ProjectPropertyField =
  | "status"
  | "priority"
  | "leadId"
  | "startDate"
  | "targetDate";
export function ProjectProperty({
  project,
  field,
  compact = false,
}: {
  project: ProjectSummary;
  field: ProjectPropertyField;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const labels = usePlanningLabels();
  const client = useQueryClient();
  const { canUpdateProjects } = useWorkspacePermission();
  const [open, setOpen] = useState(false);
  const dateField = field === "startDate" || field === "targetDate";
  const label = t(`parity:planning.${field === "leadId" ? "lead" : field}`);
  const value =
    field === "status"
      ? labels.status[project.status]
      : field === "priority"
        ? labels.priority[project.priority]
        : field === "leadId"
          ? (project.leadName ?? t("parity:planning.noLead"))
          : project[field]
            ? formatDateMedium(new Date(`${project[field]}T12:00:00`))
            : t("parity:planning.noDate");
  const members = useQuery({
    queryKey: ["workspace-users", project.workspaceId, "project", project.id],
    queryFn: () =>
      getProjectMembers({
        workspaceId: project.workspaceId,
        projectId: project.id,
      }),
    enabled: open && field === "leadId",
  });
  const mutation = useMutation({
    mutationKey: ["parity"],
    mutationFn: (patch: PlanInput) => updateProjectPlan(project.id, patch),
    onSuccess: async () => {
      await refreshPlanning(client);
      setOpen(false);
    },
  });
  const choices =
    field === "status"
      ? projectStatuses.map((id) => ({ id, name: labels.status[id] }))
      : field === "priority"
        ? priorities.map((id) => ({ id, name: labels.priority[id] }))
        : [
            { id: "", name: t("parity:planning.noLead") },
            ...(project.leadId &&
            !members.data?.some((member) => member.id === project.leadId)
              ? [
                  {
                    id: project.leadId,
                    name: project.leadName ?? t("parity:planning.deletedUser"),
                  },
                ]
              : []),
            ...(members.data ?? []),
          ];
  const icon =
    field === "status" ? (
      <PlanningStatusIcon status={project.status} />
    ) : field === "priority" ? (
      getPriorityIcon(project.priority)
    ) : field === "leadId" ? (
      <UserRound className="size-3.5 shrink-0" />
    ) : (
      <CalendarDays className="size-3.5 shrink-0" />
    );
  const content = (
    <>
      <span aria-hidden="true" className="shrink-0 text-muted-foreground">
        {icon}
      </span>
      <span
        className={
          compact &&
          (field === "priority" || field === "leadId" || field === "status")
            ? "sr-only"
            : "truncate"
        }
      >
        {value}
      </span>
    </>
  );
  if (!canUpdateProjects())
    return (
      <span
        title={`${label}: ${value}`}
        className="inline-flex max-w-full items-center gap-2 px-2 py-1 text-xs"
      >
        {content}
      </span>
    );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) mutation.reset();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value}`}
          title={`${label}: ${value}`}
          className="inline-flex h-7 max-w-full items-center gap-2 rounded-md px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const selected = String(
              new FormData(event.currentTarget).get("value") ?? "",
            );
            mutation.mutate({ [field]: selected || null } as PlanInput);
          }}
        >
          <label className="grid gap-2 text-xs">
            {label}
            {dateField ? (
              <input
                type="date"
                name="value"
                defaultValue={project[field] ?? ""}
                className="h-8 min-w-0 rounded-md border bg-background px-2"
                disabled={mutation.isPending}
              />
            ) : (
              <select
                name="value"
                defaultValue={project[field] ?? ""}
                className="h-8 rounded-md border bg-background px-2"
                disabled={
                  mutation.isPending ||
                  (field === "leadId" && (members.isPending || members.isError))
                }
              >
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          {field === "leadId" && members.isError && (
            <div role="alert" className="text-xs text-destructive">
              {members.error.message}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => members.refetch()}
              >
                {t("parity:planning.retry")}
              </Button>
            </div>
          )}
          {mutation.error && (
            <p role="alert" className="text-xs text-destructive">
              {mutation.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {dateField && project[field] && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ [field]: null })}
              >
                {t("parity:planning.clear")}
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={
                mutation.isPending ||
                (field === "leadId" && (members.isPending || members.isError))
              }
            >
              {t("parity:planning.save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
