import { useLocalSearchParams } from "expo-router";
import { TeamsScreen } from "@/features/parity/teams/teams-screen";
export default function Route() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  return <TeamsScreen key={workspaceId} workspaceId={workspaceId} />;
}
