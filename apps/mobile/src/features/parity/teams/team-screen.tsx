import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Screen,
} from "@/components/screen";
import { Txt } from "@/components/text";
import { userMessage } from "@/lib/api/client";
import { PlanningTabs } from "../planning/planning-tabs";
import { usePlanningEnabled } from "../planning/queries";
import { IssuesList } from "../views/issues-list";
import { teamsApi } from "./api";
import { TeamProjects } from "./team-projects";
export function TeamScreen({
  workspaceId,
  teamId,
}: {
  workspaceId: string;
  teamId: string;
}) {
  const { t } = useTranslation(["mobile"]);
  const enabled = usePlanningEnabled("teams");
  const [tab, setTab] = useState<"issues" | "projects">("issues");
  const query = useQuery({
    queryKey: ["parity", "team", workspaceId, teamId],
    queryFn: () => teamsApi.get(workspaceId, teamId),
    enabled,
  });
  return (
    <Screen surface>
      <PageHeader title={query.data?.name ?? t("mobile:parity.teams.title")} />
      {!enabled ? (
        <EmptyState title={t("mobile:parity.planning.unavailable")} />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          message={userMessage(query.error)}
          onRetry={query.refetch}
        />
      ) : (
        <>
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Txt tone="muted">
              {query.data.key}
              {query.data.archivedAt
                ? ` · ${t("mobile:parity.teams.archived")}`
                : ""}
            </Txt>
            {query.data.description && <Txt>{query.data.description}</Txt>}
          </View>
          <PlanningTabs
            value={tab}
            options={[
              { value: "issues", label: t("mobile:parity.teams.issues") },
              { value: "projects", label: t("mobile:parity.teams.projects") },
            ]}
            onChange={setTab}
          />
          {tab === "issues" ? (
            <IssuesList workspaceId={workspaceId} teamId={teamId} />
          ) : (
            <TeamProjects workspaceId={workspaceId} teamId={teamId} />
          )}
        </>
      )}
    </Screen>
  );
}
