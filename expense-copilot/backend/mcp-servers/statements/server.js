
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import pool from "../../src/config/db.js";
import { registerStatementTools } from "./tools.js";

function buildServer() {
  const server = new McpServer({
    name: "expense-statements-server",
    version: "1.0.0"
  });

  registerStatementTools(server, pool);

  return server;
}

try {
  serveStdio(buildServer, {
    onerror: (error) => {
      console.error("Statements MCP server failed:", error);
      process.exitCode = 1;
    }
  });
} catch (error) {
  console.error("Statements MCP server failed:", error);
  process.exit(1);
}
