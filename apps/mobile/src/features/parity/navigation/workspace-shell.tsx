import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorState, Loading, Screen } from "@/components/screen";
import { invalidateParity } from "@/features/parity/foundation/workspace-events";
import { userMessage } from "@/lib/api/client";
import { useCurrentWorkspace } from "@/lib/hooks";
import { qk } from "@/lib/query";
import { useRealtime } from "@/lib/realtime";
import { NoWorkspace } from "./no-workspace";
import { HomeWorkspaceContext } from "./workspace-context";

/** One socket and workspace gate shared by every native tab. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const { workspace, isLoading, error, refetch } = useCurrentWorkspace();
  useRealtime("api/ws/user", (event) => {
    invalidateParity(client, event);
    if (event.type === "NOTIFICATION_CREATED") {
      if (workspace)
        void client.invalidateQueries({
          queryKey: qk.notifications(workspace.id),
        });
      void client.invalidateQueries({ queryKey: ["activity"] });
    } else if (
      [
        "WORKSPACE_ACCESS_REVOKED",
        "WORKSPACE_ACCESS_SYNC",
        "PROJECT_ACCESS_CHANGED",
      ].includes(event.type)
    ) {
      void client.invalidateQueries();
    }
  });
  if (isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (error && !workspace)
    return (
      <Screen>
        <ErrorState message={userMessage(error)} onRetry={refetch} />
      </Screen>
    );
  if (!workspace) return <NoWorkspace />;
  return (
    <HomeWorkspaceContext.Provider key={workspace.id} value={workspace}>
      {children}
    </HomeWorkspaceContext.Provider>
  );
}
