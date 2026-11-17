import { createHash } from "node:crypto";

export function allocateTeamKey(name: string, taken: ReadonlySet<string>) {
  const base = name
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 5)
    .padEnd(2, "X");
  if (!taken.has(base)) return base;
  const prefix = base.slice(0, 3);
  for (let index = 0; index < 26 * 26; index++) {
    const candidate =
      prefix +
      String.fromCharCode(65 + Math.floor(index / 26), 65 + (index % 26));
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Team key space exhausted");
}

// Matches Better Auth 1.7's canonical key; old null-key rows stay readable.
export function teamMembershipKey(teamId: string, userId: string) {
  return createHash("sha256")
    .update(JSON.stringify([teamId, userId]))
    .digest("base64url");
}
