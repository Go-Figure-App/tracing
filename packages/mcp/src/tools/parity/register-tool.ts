import { z } from "zod";
import { errorResult, textResult } from "../../utils/mcp-result.js";
import type { ToolClient, ToolRegistrar } from "../register.js";

export function parityTool(server: ToolRegistrar, client: ToolClient) {
  return function register<S extends z.ZodObject>(
    name: string,
    description: string,
    inputSchema: S,
    run: (input: z.output<S>, client: ToolClient) => Promise<unknown>,
  ) {
    server.registerTool(name, { description, inputSchema }, async (input) => {
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success) return errorResult(z.prettifyError(parsed.error));
      try {
        return textResult(await run(parsed.data, client));
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    });
  };
}
