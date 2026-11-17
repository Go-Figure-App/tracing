import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
export function useTeamPermissions(workspaceId: string) {
  return useQuery({
    queryKey: ["parity", "team-permissions", workspaceId],
    queryFn: async () => {
      const check = async (action: "create" | "update" | "delete") =>
        (
          await authClient.organization.hasPermission({
            organizationId: workspaceId,
            permissions: { team: [action] },
          })
        ).data?.success === true;
      const [create, update, remove] = await Promise.all([
        check("create"),
        check("update"),
        check("delete"),
      ]);
      return { create, update, remove };
    },
    enabled: Boolean(workspaceId),
  });
}
