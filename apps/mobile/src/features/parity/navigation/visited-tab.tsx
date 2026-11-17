import { useIsFocused } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";

/** Native tabs mount eagerly; defer requests until a tab is visited, then retain its state. */
export function VisitedTab({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const [visited, setVisited] = useState(false);
  useEffect(() => {
    if (focused) setVisited(true);
  }, [focused]);
  return focused || visited ? children : null;
}
