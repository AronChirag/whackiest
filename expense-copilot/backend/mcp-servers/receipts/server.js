
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import pool from "../../src/config/db.js";
import { registerReceiptTools } from "./tools.js";

function buildServer() {
  const server = new McpServer({
    name: "expense-receipts-server",
    version: "1.0.0"
  });

  registerReceiptTools(server, pool);
  return server;
}

try {
  serveStdio(buildServer, {
    onerror: (error) => {
      console.error("Receipts MCP server failed:", error);
      process.exitCode = 1;
    }
  });
} catch (error) {
  console.error("Receipts MCP server failed:", error);
  process.exit(1);
}
