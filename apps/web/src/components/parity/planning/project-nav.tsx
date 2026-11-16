import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useUserPreferencesStore } from "@/store/user-preferences";
import {
  routeForView,
  tasksViewFor,
} from "@/components/project/views/project-views";
import { usePlanningEnabled } from "./queries";
export function ProjectPlanningNav({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const enabled = usePlanningEnabled("projects");
  const { pathname } = useLocation();
  const taskLayout = useUserPreferencesStore((state) => state.taskLayout);
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  if (!enabled) return null;
  const base = `/dashboard/workspace/${workspaceId}/project/${projectId}`;
  const overview = pathname.endsWith("/overview");
  const updates = pathname.endsWith("/updates");
  return (
    <nav
      aria-label={t("parity:planning.projectNavigation")}
      className="flex shrink-0 items-center gap-1"
    >
      {[
        {
          label: t("parity:planning.overview"),
          href: `${base}/overview`,
          active: overview,
        },
        {
          label: t("parity:planning.updates"),
          href: `${base}/updates`,
          active: updates,
        },
        {
          label: t("parity:cycles.tasks"),
          href: `${base}/${routeForView(tasksViewFor(taskLayout, viewMode))}`,
          active: !overview && !updates,
        },
      ].map((tab) => (
        <Link
          key={tab.href}
          to={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${tab.active ? "bg-accent font-medium text-foreground" : "text-muted-foreground"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
