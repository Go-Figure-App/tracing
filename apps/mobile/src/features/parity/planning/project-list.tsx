import { router } from "expo-router";
import { Plus, SlidersHorizontal } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, View } from "react-native";
import { ListGroupHeader } from "@/components/rows";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  useBottomInset,
} from "@/components/screen";
import { OptionSheet, SearchField } from "@/components/sheet";
import { Txt } from "@/components/text";
import { IconButton } from "@/components/ui";
import { NewProjectSheet } from "@/features/home/new-project-sheet";
import { userMessage } from "@/lib/api/client";
import { currentLocale } from "@/lib/i18n";
import { useColors } from "@/theme";
import { projectStatuses, usePlanningLabels } from "./labels";
import { PlanningTabs } from "./planning-tabs";
import { selectProjects, type ProjectOrder } from "./project-collection";
import { usePlanningProjects } from "./project-queries";
import { PlanningProjectRow } from "./project-row";
import { usePlanningEnabled, usePlanningPermissions } from "./queries";
import { uniquePageItems } from "./unique-page-items";

export function ProjectList({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const bottom = useBottomInset(24);
  const labels = usePlanningLabels();
  const enabled = usePlanningEnabled();
  const permissions = usePlanningPermissions(workspaceId);
  const query = usePlanningProjects(workspaceId, enabled);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [order, setOrder] = useState<ProjectOrder>("name");
  const [ordering, setOrdering] = useState(false);
  const [creating, setCreating] = useState(false);
  const items = selectProjects(
    query.isError ? [] : uniquePageItems(query.data?.pages),
    search,
    status,
    order,
    currentLocale(),
  );
  const sections = projectStatuses
    .map((value) => ({
      key: value,
      title: labels.status[value],
      data: items.filter((project) => project.status === value),
    }))
    .filter((section) => section.data.length);
  return (
    <Screen surface>
      <PageHeader
        title={t("mobile:home.projects")}
        action={
          <View style={{ flexDirection: "row" }}>
            <IconButton
              size={44}
              label={t("mobile:parity.planning.sortProjects")}
              onPress={() => setOrdering(true)}
            >
              <SlidersHorizontal size={20} color={c.ink2} />
            </IconButton>
            {permissions.data?.createProjects && (
              <IconButton
                size={44}
                label={t("mobile:home.newProject")}
                onPress={() => setCreating(true)}
              >
                <Plus size={22} color={c.ink2} />
              </IconButton>
            )}
          </View>
        }
      />
      {!enabled ? (
        <Txt center>{t("mobile:parity.planning.unavailable")}</Txt>
      ) : (
        <>
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t("mobile:parity.planning.searchProjects")}
            />
          </View>
          <PlanningTabs
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: t("mobile:parity.planning.all") },
              ...projectStatuses.map((value) => ({
                value,
                label: labels.status[value],
              })),
            ]}
          />
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState
              message={userMessage(query.error)}
              onRetry={query.refetch}
            />
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              stickySectionHeadersEnabled={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              contentContainerStyle={{ paddingBottom: bottom + 20 }}
              renderSectionHeader={({ section }) => (
                <ListGroupHeader
                  title={section.title}
                  count={section.data.length}
                />
              )}
              renderItem={({ item }) => <PlanningProjectRow project={item} />}
              ListEmptyComponent={
                !query.hasNextPage ? (
                  <EmptyState title={t("mobile:parity.planning.noProjects")} />
                ) : undefined
              }
              ListFooterComponent={query.hasNextPage ? <Loading /> : undefined}
            />
          )}
        </>
      )}
      <OptionSheet
        visible={ordering}
        onClose={() => setOrdering(false)}
        title={t("mobile:parity.planning.sortProjects")}
        selected={order}
        onSelect={setOrder}
        options={(
          [
            ["name", t("mobile:projectNew.name")],
            ["priority", t("mobile:parity.planning.priority")],
            ["targetDate", t("mobile:parity.planning.targetDate")],
            ["progress", t("mobile:parity.planning.progress")],
          ] as const
        ).map(([value, label]) => ({ value, label }))}
      />
      <NewProjectSheet
        visible={creating}
        onClose={() => setCreating(false)}
        workspaceId={workspaceId}
        onCreated={(project) =>
          router.push({
            pathname: "/project/[projectId]/overview",
            params: { projectId: project.id },
          })
        }
      />
    </Screen>
  );
}
