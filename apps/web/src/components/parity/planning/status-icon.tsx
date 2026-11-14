import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleX,
} from "lucide-react";
import { cn } from "@/lib/cn";

export function PlanningStatusIcon({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const Icon =
    status === "completed"
      ? CircleCheck
      : status === "canceled"
        ? CircleX
        : status === "paused"
          ? CirclePause
          : status === "started" || status === "active"
            ? CircleDot
            : status === "backlog"
              ? CircleDashed
              : Circle;
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        "size-3.5 shrink-0",
        {
          "text-muted-foreground": [
            "backlog",
            "planned",
            "unstarted",
            "canceled",
          ].includes(status),
          "text-amber-600 dark:text-amber-400": [
            "started",
            "active",
            "paused",
          ].includes(status),
          "text-indigo-600 dark:text-indigo-400": status === "completed",
        },
        className,
      )}
    />
  );
}
