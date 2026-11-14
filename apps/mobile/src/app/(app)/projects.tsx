import { useLocalSearchParams } from "expo-router";
import { ProjectList } from "@/features/parity/planning/project-list";

export default function ProjectsRoute() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  return <ProjectList key={workspaceId} workspaceId={workspaceId} />;
}
