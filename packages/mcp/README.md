# Tracing MCP

Tracing’s authenticated HTTP MCP endpoint is available at:

```text
https://tracing.gofigureapp.io/api/mcp
```

Connect with a client that supports Streamable HTTP and complete the app’s OAuth sign-in. Tools use the same workspace and project permissions as the app, including the planning, cycle, insight, view, and triage tools.

For a local stdio connection, build this repository and run:

```sh
pnpm --filter @tracing/mcp build
TRACING_API_URL=https://tracing.gofigureapp.io node packages/mcp/dist/index.js serve
```

The stdio server uses device authorization. `TRACING_API_KEY` can supply an existing API key for a headless client; keep it in the client’s secret configuration. `KANEO_API_URL`, `KANEO_API_KEY`, and `KANEO_MCP_CLIENT_ID` remain compatibility aliases.

`@tracing/mcp` is a workspace package, not a published npm package. Use the hosted endpoint or this source build. Manufact can connect to the existing endpoint; account entitlement and evaluation billing must be checked before activation. See [the assessment](../../PARITY.md#manufact-mcp-assessment).

The original Kaneo MIT license is retained in [LICENSE](LICENSE).

## Planning management

The shared tool catalog supports milestone creation/editing/reordering/deletion and task assignment; initiative editing, archive/restore, deletion, ordering and project link/unlink; status update feeds; cycle cadence configuration, generated-cycle editing and filtered cycle issue lists. See [the complete tool guide](../../apps/docs/core/integrations/mcp.mdx#planning-tools).

Cycles use Tracing's existing automatic lifecycle: `update_cycle_settings` enables generation and configures cadence/lookahead, while `update_cycle` renames or reschedules upcoming cycles. Individual manual creation/deletion is not an API capability. All tools preserve the existing permission checks and feature gates.
