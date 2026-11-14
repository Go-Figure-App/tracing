import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleX,
} from "lucide-react-native";
import { useColors } from "@/theme";
import type { InitiativeStatus, ProjectStatus } from "./types";

export function PlanningStatusIcon({
  status,
  size = 16,
}: {
  status: ProjectStatus | InitiativeStatus;
  size?: number;
}) {
  const c = useColors();
  const Icon =
    status === "completed"
      ? CircleCheck
      : status === "started" || status === "active"
        ? CircleDot
        : status === "paused"
          ? CirclePause
          : status === "canceled"
            ? CircleX
            : status === "backlog"
              ? CircleDashed
              : Circle;
  return (
    <Icon
      size={size}
      color={
        status === "started" || status === "active"
          ? c.warningFg
          : status === "completed"
            ? c.infoFg
            : c.muted
      }
    />
  );
}
