import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePlanningEnabled } from "../planning/queries";
import { useTeams } from "./queries";
export function TeamFilter({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const enabled = usePlanningEnabled("teams");
  const query = useTeams(workspaceId);
  useEffect(() => {
    if (
      enabled &&
      query.isSuccess &&
      !query.isFetching &&
      value &&
      value !== "none" &&
      !query.data.some((team) => team.id === value)
    )
      onChange("");
  }, [enabled, query.isSuccess, query.isFetching, query.data, value, onChange]);
  if (!enabled) return null;
  return (
    <label className="flex items-center gap-2 text-xs">
      {t("parity:teams.team")}
      <select
        aria-label={t("parity:teams.team")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={query.isPending || query.isError}
        className="h-8 max-w-48 rounded-md border bg-background px-2"
      >
        <option value="">{t("parity:teams.all")}</option>
        <option value="none">{t("parity:teams.noTeam")}</option>
        {query.data?.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      {query.isError && (
        <button onClick={() => void query.refetch()}>
          {t("parity:planning.retry")}
        </button>
      )}
      {query.isError && value && (
        <button
          onClick={() => {
            onChange("");
            void query.refetch();
          }}
        >
          {t("parity:teams.all")}
        </button>
      )}
    </label>
  );
}
