import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  projectColumns,
  type ProjectColumn,
  type ProjectGrouping,
  type ProjectOrder,
} from "./project-collection";

export function ProjectDisplayOptions({
  groupBy,
  setGroupBy,
  orderBy,
  setOrderBy,
  columns,
  setColumns,
  layout,
  setLayout,
}: {
  layout?: "list" | "board";
  setLayout?: (value: "list" | "board") => void;
  groupBy: ProjectGrouping;
  setGroupBy: (value: ProjectGrouping) => void;
  orderBy: ProjectOrder;
  setOrderBy: (value: ProjectOrder) => void;
  columns: ProjectColumn[];
  setColumns: (value: ProjectColumn[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2 className="size-3.5" />
          {t("parity:views.display")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4 p-4">
        {setLayout && (
          <div
            role="group"
            aria-label={t("parity:planning.layout")}
            className="grid grid-cols-2 gap-2"
          >
            {(["list", "board"] as const).map((value) => (
              <Button
                key={value}
                variant={layout === value ? "secondary" : "outline"}
                size="sm"
                aria-pressed={layout === value}
                onClick={() => setLayout(value)}
              >
                {t(`tasks:view.${value}`)}
              </Button>
            ))}
          </div>
        )}
        <label className="flex items-center justify-between gap-4 text-xs">
          {t("parity:views.groupBy")}
          <select
            className="rounded-md border bg-background px-2 py-1.5"
            disabled={layout === "board"}
            value={layout === "board" ? "status" : groupBy}
            onChange={(event) =>
              setGroupBy(event.target.value as ProjectGrouping)
            }
          >
            <option value="none">{t("parity:planning.noGrouping")}</option>
            <option value="status">{t("parity:planning.status")}</option>
            <option value="lead">{t("parity:planning.lead")}</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-4 text-xs">
          {t("parity:views.orderBy")}
          <select
            className="rounded-md border bg-background px-2 py-1.5"
            value={orderBy}
            onChange={(event) => setOrderBy(event.target.value as ProjectOrder)}
          >
            {(["name", "priority", "targetDate", "progress"] as const).map(
              (value) => (
                <option key={value} value={value}>
                  {t(`parity:planning.${value}`)}
                </option>
              ),
            )}
          </select>
        </label>
        <fieldset className="flex flex-wrap gap-1.5 border-t pt-3">
          <legend className="text-xs text-muted-foreground">
            {t("parity:views.properties")}
          </legend>
          {projectColumns.map((column) => (
            <Button
              key={column}
              size="sm"
              variant={columns.includes(column) ? "secondary" : "outline"}
              className="h-7 rounded-full px-2.5 text-xs"
              aria-pressed={columns.includes(column)}
              onClick={() =>
                setColumns(
                  columns.includes(column)
                    ? columns.filter((item) => item !== column)
                    : [...columns, column],
                )
              }
            >
              {t(`parity:planning.${column}`)}
            </Button>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
