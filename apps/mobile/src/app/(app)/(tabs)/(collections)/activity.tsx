import { BackButton, ErrorState, Loading, Screen } from "@/components/screen";
import { ActivityTab } from "@/features/home/activity-tab";
import { NoWorkspace } from "@/features/parity/navigation/no-workspace";
import { userMessage } from "@/lib/api/client";
import { useCurrentWorkspace } from "@/lib/hooks";

export default function ActivityScreen() {
  const { workspace, isLoading, error, refetch } = useCurrentWorkspace();
  if (!isLoading && !error && !workspace) return <NoWorkspace />;
  return (
    <Screen surface>
      <BackButton />
      {workspace ? (
        <ActivityTab key={workspace.id} workspace={workspace} />
      ) : error ? (
        <ErrorState message={userMessage(error)} onRetry={refetch} />
      ) : (
        <Loading />
      )}
    </Screen>
  );
}
