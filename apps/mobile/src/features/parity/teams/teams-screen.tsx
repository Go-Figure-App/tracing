import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Scroll,
} from "@/components/screen";
import { Txt } from "@/components/text";
import { Group, Touch } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { usePlanningEnabled } from "../planning/queries";
import { useTeams } from "./queries";
export function TeamsScreen({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(["mobile"]);
  const enabled = usePlanningEnabled("teams");
  const query = useTeams(workspaceId);
  return (
    <Scroll
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <PageHeader title={t("mobile:parity.teams.title")} />
      {!enabled ? (
        <EmptyState title={t("mobile:parity.planning.unavailable")} />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          message={userMessage(query.error)}
          onRetry={query.refetch}
        />
      ) : !query.data.length ? (
        <EmptyState title={t("mobile:parity.teams.empty")} />
      ) : (
        <View style={{ padding: 20 }}>
          <Group>
            {query.data.map((team) => (
              <Touch
                key={team.id}
                onPress={() =>
                  router.push({
                    pathname: "/team/[teamId]",
                    params: { teamId: team.id, workspaceId },
                  })
                }
                style={{ padding: 18, gap: 4 }}
              >
                <Txt weight="medium">
                  {team.key} · {team.name}
                </Txt>
                {team.archivedAt && (
                  <Txt tone="muted">{t("mobile:parity.teams.archived")}</Txt>
                )}
              </Touch>
            ))}
          </Group>
        </View>
      )}
    </Scroll>
  );
}
