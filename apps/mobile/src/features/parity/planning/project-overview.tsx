import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Calendar, MoreHorizontal, User } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { MarkdownText } from "@/components/markdown";
import {
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  Scroll,
  useBottomInset,
} from "@/components/screen";
import { OptionSheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { IconButton } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useAction } from "@/lib/query";
import { useColors } from "@/theme";
import { planningApi } from "./api";
import { PlanningHealth } from "./health";
import { projectStatuses, usePlanningLabels } from "./labels";
import { PlanningTabs } from "./planning-tabs";
import { ProjectInitiatives } from "./project-initiatives";
import { PlanningProgress } from "./progress";
import { PlanningPropertyChip } from "./property-chip";
import { usePlanningEnabled, usePlanningPermissions } from "./queries";
import { PlanningStatusIcon } from "./status-icon";
import { PlanningUpdates } from "./update-feed";

export function ProjectOverview({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const bottom = useBottomInset(24);
  const labels = usePlanningLabels();
  const enabled = usePlanningEnabled();
  const [tab, setTab] = useState<"overview" | "updates" | "issues">("overview");
  const [statusOpen, setStatusOpen] = useState(false);
  const { run, busy } = useAction("parity");
  const query = useQuery({
    queryKey: ["parity", "project", projectId],
    queryFn: () => planningApi.project(projectId),
    enabled,
  });
  const project = query.isError ? undefined : query.data;
  const client = useQueryClient();
  const dependentQueryKey =
    tab === "updates"
      ? ["parity", "updates", "project", projectId]
      : ["parity", "roadmap", project?.workspaceId];
  const dependentFetching = useIsFetching({
    queryKey: dependentQueryKey,
    exact: true,
  });
  const permissions = usePlanningPermissions(project?.workspaceId);
  const edit =
    project && permissions.data?.updateProjects
      ? () =>
          router.push({
            pathname: "/project/[projectId]/plan",
            params: { projectId },
          })
      : undefined;
  return (
    <Screen surface>
      <PageHeader
        title={project?.name ?? t("mobile:parity.planning.overview")}
        action={
          edit && (
            <IconButton
              size={44}
              label={t("mobile:parity.planning.editProperties")}
              onPress={edit}
            >
              <MoreHorizontal size={22} color={c.ink2} />
            </IconButton>
          )
        }
      />
      {!enabled ? (
        <Txt center>{t("mobile:parity.planning.unavailable")}</Txt>
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          message={userMessage(query.error)}
          onRetry={query.refetch}
        />
      ) : (
        project && (
          <>
            <PlanningTabs
              value={tab}
              options={[
                {
                  value: "overview",
                  label: t("mobile:parity.planning.overview"),
                },
                {
                  value: "updates",
                  label: t("mobile:parity.planning.updates"),
                },
                { value: "issues", label: t("mobile:parity.cycles.tasks") },
              ]}
              onChange={(value) => {
                if (value === "issues")
                  router.push({
                    pathname: "/board/[projectId]",
                    params: { projectId, workspaceId: project.workspaceId },
                  });
                else setTab(value);
              }}
            />
            <Scroll
              refreshing={query.isRefetching || dependentFetching > 0}
              onRefresh={() => {
                void query.refetch();
                void client.refetchQueries({
                  queryKey: dependentQueryKey,
                  exact: true,
                  type: "active",
                });
              }}
              bottomPadding={bottom + 24}
            >
              <View style={{ padding: 20, gap: 24 }}>
                {tab === "updates" ? (
                  <PlanningUpdates
                    kind="project"
                    id={projectId}
                    health={project.health}
                    canUpdate={permissions.data?.updateProjects ?? false}
                  />
                ) : (
                  <>
                    <View style={{ gap: 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <PlanningPropertyChip
                          label={t("mobile:parity.planning.status")}
                          value={labels.status[project.status]}
                          icon={<PlanningStatusIcon status={project.status} />}
                          disabled={busy}
                          onPress={edit ? () => setStatusOpen(true) : undefined}
                        />
                        <PlanningPropertyChip
                          label={t("mobile:parity.planning.priority")}
                          value={labels.priority[project.priority]}
                          onPress={edit}
                        />
                        <PlanningPropertyChip
                          label={t("mobile:parity.planning.lead")}
                          value={
                            project.leadName ??
                            t("mobile:parity.planning.noLead")
                          }
                          icon={<User size={15} color={c.muted} />}
                          onPress={edit}
                        />
                        <PlanningPropertyChip
                          label={t("mobile:parity.planning.startDate")}
                          value={`${t("mobile:parity.planning.startDate")}: ${project.startDate ? formatDate(project.startDate) : t("mobile:parity.planning.noDate")}`}
                          onPress={edit}
                        />
                        <PlanningPropertyChip
                          label={t("mobile:parity.planning.targetDate")}
                          value={
                            project.targetDate
                              ? formatDate(project.targetDate)
                              : t("mobile:parity.planning.noDate")
                          }
                          icon={<Calendar size={15} color={c.muted} />}
                          onPress={edit}
                        />
                      </View>
                      <ProjectInitiatives
                        workspaceId={project.workspaceId}
                        projectId={projectId}
                      />
                    </View>
                    <View style={{ gap: 12 }}>
                      <PlanningHealth health={project.health} />
                      <PlanningProgress progress={project.progress} />
                    </View>
                    {project.description ? (
                      <MarkdownText>{project.description}</MarkdownText>
                    ) : (
                      <Txt tone="muted">
                        {t("mobile:parity.planning.noDescription")}
                      </Txt>
                    )}
                    <View style={{ gap: 12 }}>
                      <Txt variant="section">
                        {t("mobile:parity.planning.milestones")}
                      </Txt>
                      {!project.milestones.length && (
                        <Txt tone="muted">
                          {t("mobile:parity.planning.noMilestones")}
                        </Txt>
                      )}
                      {project.milestones.map((milestone) => (
                        <View
                          key={milestone.id}
                          style={{
                            borderBottomWidth: 1,
                            borderBottomColor: c.divider,
                            paddingVertical: 14,
                            gap: 8,
                          }}
                        >
                          <Txt variant="body" weight="medium">
                            {milestone.name}
                          </Txt>
                          {milestone.targetDate && (
                            <Txt variant="caption" tone="muted">
                              {formatDate(milestone.targetDate)}
                            </Txt>
                          )}
                          {milestone.description && (
                            <MarkdownText>{milestone.description}</MarkdownText>
                          )}
                          <PlanningProgress progress={milestone.progress} />
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </Scroll>
            <OptionSheet
              visible={statusOpen && Boolean(edit)}
              onClose={() => setStatusOpen(false)}
              title={t("mobile:parity.planning.status")}
              selected={project.status}
              options={projectStatuses.map((value) => ({
                value,
                label: labels.status[value],
                leading: <PlanningStatusIcon status={value} />,
              }))}
              onSelect={(status) => {
                void run(() =>
                  planningApi.updateProject(projectId, { status }),
                );
              }}
            />
          </>
        )
      )}
    </Screen>
  );
}
