import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Flag } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useColors } from "@/theme";
import { getRoadmap } from "../roadmap/api";
import { PlanningPropertyChip } from "./property-chip";
import { usePlanningEnabled } from "./queries";

export function ProjectInitiatives({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const enabled = usePlanningEnabled("roadmap");
  const query = useQuery({
    queryKey: ["parity", "roadmap", workspaceId],
    queryFn: () => getRoadmap(workspaceId),
    enabled,
  });
  const ids =
    !enabled || query.isError
      ? []
      : (query.data?.projects.find((project) => project.id === projectId)
          ?.initiativeIds ?? []);
  if (!ids.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {query.data?.initiatives
        .filter((item) => ids.includes(item.id))
        .map((item) => (
          <PlanningPropertyChip
            key={item.id}
            label={t("mobile:parity.planning.initiative")}
            value={item.name}
            icon={<Flag size={15} color={c.muted} />}
            onPress={() =>
              router.push({
                pathname: "/initiative/[initiativeId]",
                params: { initiativeId: item.id },
              })
            }
          />
        ))}
    </View>
  );
}
