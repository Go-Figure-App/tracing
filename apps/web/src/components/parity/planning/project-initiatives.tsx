import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getRoadmap } from "@/fetchers/parity/roadmap";
import { usePlanningEnabled } from "./queries";

export function ProjectInitiatives({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const enabled = usePlanningEnabled("roadmap");
  const query = useQuery({
    queryKey: ["parity", "roadmap", workspaceId],
    queryFn: () => getRoadmap(workspaceId),
    enabled,
  });
  if (!enabled || query.isError || !query.data) return null;
  const ids =
    query.data.projects.find((project) => project.id === projectId)
      ?.initiativeIds ?? [];
  const initiatives = query.data.initiatives.filter((initiative) =>
    ids.includes(initiative.id),
  );
  if (!initiatives.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground">
        {t("parity:planning.initiatives")}
      </h2>
      <div className="flex flex-wrap gap-2">
        {initiatives.map((initiative) => (
          <Link
            key={initiative.id}
            to="/dashboard/workspace/$workspaceId/initiatives/$initiativeId"
            params={{ workspaceId, initiativeId: initiative.id }}
            className="inline-flex max-w-full items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Target aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{initiative.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
