import { useTranslation } from "react-i18next";
import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePlanningLabels } from "./labels";

export function HealthBadge({
  health,
}: {
  health: "on_track" | "at_risk" | "off_track" | null;
}) {
  const labels = usePlanningLabels();
  const { t } = useTranslation();
  if (!health)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleDashed aria-hidden="true" className="size-3.5" />
        {t("parity:planning.noHealthUpdates")}
      </span>
    );
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs", {
        "text-emerald-600 dark:text-emerald-400": health === "on_track",
        "text-amber-600 dark:text-amber-400": health === "at_risk",
        "text-red-600 dark:text-red-400": health === "off_track",
      })}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {labels.health[health]}
    </span>
  );
}
