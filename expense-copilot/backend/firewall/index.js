
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { getToolPolicy } from "./tool-allowlist.js";
import { validateToolArguments } from "./schema-validator.js";
import { redactSensitiveData } from "./redaction.js";
import { addTrustLabels } from "./trust-labels.js";
import { runCanaryChecks } from "./canary.js";
import {
  assertMcpEnabled,
  isMcpEnabled
} from "./kill-switch.js";
import { logSecurityEvent } from "./audit-logger.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(currentDir, "..");

const SERVER_PATHS = {
  statements: path.join(
    backendDir, "mcp-servers", "statements", "server.js"
  ),
  receipts: path.join(
    backendDir, "mcp-servers", "receipts", "server.js"
  ),
  budget: path.join(
    backendDir, "mcp-servers", "budget", "server.js"
  )
};

const clients = new Map();
const toolRegistry = new Map();

let databasePool = null;

export function configureFirewall(pool) {
  databasePool = pool;
}

async function connectServer(serverName) {
  if (clients.has(serverName)) {
    return clients.get(serverName);
  }

  const serverPath = SERVER_PATHS[serverName];

  if (!serverPath) {
    throw new Error("Unknown MCP server.");
  }

  const client = new Client({
    name: "expense-copilot-firewall",
    version: "1.0.0"
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: backendDir,
    stderr: "inherit"
  });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();

    for (const tool of tools) {
      const policy = getToolPolicy(tool.name);

      if (policy?.server === serverName) {
        toolRegistry.set(tool.name, {
          server: serverName,
          description: tool.description || "",
          inputSchema: tool.inputSchema
        });
      }
    }

    clients.set(serverName, client);
    return client;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

export async function initializeFirewall() {
  try {
    for (const serverName of Object.keys(SERVER_PATHS)) {
      await connectServer(serverName);
    }

    if (!toolRegistry.size) {
      throw new Error("No allowlisted MCP tools were registered.");
    }

    return {
      connectedServers: [...clients.keys()],
      registeredTools: [...toolRegistry.keys()]
    };
  } catch (error) {
    await shutdownFirewall();
    throw error;
  }
}

export function getAvailableTools() {
  return [...toolRegistry.entries()].map(([name, tool]) => {
    const properties = { ...(tool.inputSchema?.properties || {}) };
    delete properties.userId;

    const required = (tool.inputSchema?.required || [])
      .filter((property) => property !== "userId");

    return {
      name,
      server: tool.server,
      description: tool.description,
      parametersJsonSchema: {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false
      },
      policy: getToolPolicy(name)
    };
  });
}

export async function executeFirewallTool({
  toolName,
  arguments: modelArguments = {},
  userId
}) {
  if (!databasePool) {
    throw new Error("Firewall database pool is not configured.");
  }

  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
    throw new Error("Authenticated user is required.");
  }

  assertMcpEnabled();

  const policy = getToolPolicy(toolName);

  if (!policy || !toolRegistry.has(toolName)) {
    await logSecurityEvent(databasePool, {
      userId,
      eventType: "MCP_TOOL_BLOCKED",
      eventData: { toolName, reason: "Tool not allowlisted" }
    });

    throw new Error("This MCP tool is not allowed.");
  }

  if (policy.approvalRequired) {
    throw new Error("This tool requires an approval workflow.");
  }

  const canary = runCanaryChecks(toolName, modelArguments);

  if (!canary.safe) {
    await logSecurityEvent(databasePool, {
      userId,
      eventType: "MCP_CANARY_BLOCKED",
      eventData: { toolName, reason: canary.reason }
    });

    throw new Error("Security check blocked this request.");
  }

  const validation = validateToolArguments(
    toolName,
    modelArguments
  );

  if (!validation.success) {
    await logSecurityEvent(databasePool, {
      userId,
      eventType: "MCP_VALIDATION_FAILED",
      eventData: { toolName, errors: validation.error }
    });

    throw new Error("Invalid tool arguments.");
  }

  const trustedArguments = {
    ...validation.data,
    userId: Number(userId)
  };

  const serverName = toolRegistry.get(toolName).server;
  const client = await connectServer(serverName);

  await logSecurityEvent(databasePool, {
    userId,
    eventType: "MCP_TOOL_REQUESTED",
    eventData: { toolName, serverName }
  });

  const result = await client.callTool({
    name: toolName,
    arguments: trustedArguments
  });

  if (result.isError) {
    await logSecurityEvent(databasePool, {
      userId,
      eventType: "MCP_TOOL_FAILED",
      eventData: { toolName }
    });

    throw new Error("MCP tool execution failed.");
  }

  const content = (result.content || []).map((item) => {
    if (item.type !== "text") return item;

    try {
      const parsed = JSON.parse(item.text);

      const trustedData = addTrustLabels(
        parsed,
        serverName
      );

      return {
        type: "text",
        text: JSON.stringify(
          redactSensitiveData(trustedData)
        )
      };
    } catch {
      return {
        type: "text",
        text: item.text
      };
    }
  });

  await logSecurityEvent(databasePool, {
    userId,
    eventType: "MCP_TOOL_EXECUTED",
    eventData: {
      toolName,
      serverName,
      success: true
    }
  });

  return {
    success: true,
    toolName,
    server: serverName,
    content
  };
}

export async function shutdownFirewall() {
  for (const client of clients.values()) {
    try {
      await client.close();
    } catch (error) {
      console.error("MCP client shutdown error:", error.message);
    }
  }

  clients.clear();
  toolRegistry.clear();
}

export { isMcpEnabled };
