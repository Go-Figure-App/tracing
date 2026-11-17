import { Box, ListTodo, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SidebarMenu } from "@/components/ui/sidebar";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { NavigationLink } from "../navigation/navigation-link";
import { NavigationSection } from "../navigation/navigation-section";
import { usePlanningEnabled } from "../planning/queries";
import { useTeams } from "./queries";
export function TeamsNavigation() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const enabled = usePlanningEnabled("teams");
  const query = useTeams(workspace?.id ?? "");
  if (!enabled || !workspace) return null;
  const base = `/dashboard/workspace/${workspace.id}/teams`;
  return (
    <NavigationSection
      storageKey={`tracing:sidebar:${workspace.id}:teams`}
      title={t("parity:teams.yourTeams")}
    >
      <SidebarMenu>
        <NavigationLink
          title={t("parity:teams.title")}
          icon={Users}
          href={base}
          exact
        />
        {query.isPending && (
          <li role="status" className="px-3 text-xs">
            {t("parity:planning.loading")}
          </li>
        )}
        {query.isError && (
          <li>
            <button onClick={() => void query.refetch()}>
              {t("parity:planning.retry")}
            </button>
          </li>
        )}
        {query.data
          ?.filter((team) => !team.archivedAt)
          .map((team) => (
            <li key={team.id}>
              <details>
                <summary className="cursor-pointer truncate rounded px-3 py-2 text-[13px]">
                  {team.key} · {team.name}
                </summary>
                <SidebarMenu className="pl-4">
                  <NavigationLink
                    title={t("parity:teams.issues")}
                    icon={ListTodo}
                    href={`${base}/${team.id}/issues`}
                  />
                  <NavigationLink
                    title={t("parity:teams.projects")}
                    icon={Box}
                    href={`${base}/${team.id}/projects`}
                  />
                </SidebarMenu>
              </details>
            </li>
          ))}
      </SidebarMenu>
    </NavigationSection>
  );
}
