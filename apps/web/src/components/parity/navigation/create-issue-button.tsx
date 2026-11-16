import { SquarePen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function CreateIssueButton() {
  const { t } = useTranslation();
  const { canCreateTasks } = useWorkspacePermission();
  const [open, setOpen] = useState(false);
  if (!canCreateTasks()) return null;
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="size-7 shrink-0 rounded-full bg-background/60"
        aria-label={t("parity:navigation.newIssue")}
        title={t("parity:navigation.newIssue")}
        onClick={() => setOpen(true)}
      >
        <SquarePen aria-hidden="true" className="size-3.5" />
      </Button>
      <CreateTaskModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
