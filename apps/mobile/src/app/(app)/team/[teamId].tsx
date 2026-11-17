import { useLocalSearchParams } from "expo-router";
import { TeamScreen } from "@/features/parity/teams/team-screen";
export default function Route() {
  const { workspaceId, teamId } = useLocalSearchParams<{
    workspaceId: string;
    teamId: string;
  }>();
  return <TeamScreen key={teamId} workspaceId={workspaceId} teamId={teamId} />;
}
