import { MCPConfiguration } from "@mastra/mcp";

export const mcp = new MCPConfiguration({
    servers: {
      ec: {
        command: "ec",
        args: ["mcp"],
      },
    },
  });