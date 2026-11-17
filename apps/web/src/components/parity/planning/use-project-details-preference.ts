import { useState } from "react";

function readPreference(key: string) {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved !== null) return saved === "open";
  } catch {
    // The panel remains usable if preference storage is unavailable.
  }
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1280px)").matches
  );
}

export function useProjectDetailsPreference(workspaceId: string) {
  const key = `tracing:project-details:${workspaceId}`;
  const [preference, setPreference] = useState(() => ({
    key,
    open: readPreference(key),
  }));
  let open = preference.open;
  // Route parameter changes can reuse the layout instance. Reinitialize before
  // committing that render, so another workspace never inherits this choice.
  if (preference.key !== key) {
    open = readPreference(key);
    setPreference({ key, open });
  }
  return [
    open,
    (next: boolean) => {
      setPreference({ key, open: next });
      try {
        sessionStorage.setItem(key, next ? "open" : "closed");
      } catch {
        // Session persistence is optional.
      }
    },
  ] as const;
}
